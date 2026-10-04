import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright'
);
const base = process.env.TEST_URL || 'http://127.0.0.1:5173';
await mkdir('test-artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const errors = [];
const pages = [];
try {
  const hostContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    permissions: ['microphone', 'local-network-access'],
  });
  const guestContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    permissions: ['microphone', 'local-network-access'],
  });
  await guestContext.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    const blockedOnce = new WeakSet();
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !blockedOnce.has(this)) {
        blockedOnce.add(this);
        return Promise.reject(
          new DOMException('Autoplay blocked for regression test', 'NotAllowedError'),
        );
      }
      return original.call(this);
    };
  });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  pages.push(host, guest);
  for (const page of [host, guest]) {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error')
        console.log('BROWSER', m.type(), m.text());
    });
  }
  await host.goto(base);
  await host.getByRole('button', { name: 'Criar sala', exact: true }).waitFor();
  await host.screenshot({ path: 'test-artifacts/home.png' });
  await host.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await host.getByLabel('Seu nome ou apelido').fill('Nox');
  await host.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await host.getByText('Microfone ativo.', { exact: false }).waitFor();
  await host.screenshot({ path: 'test-artifacts/prejoin.png' });
  const invite = host.url();
  await host.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await host.getByText('Ninguém está compartilhando', { exact: true }).waitFor();
  await guest.goto(invite);
  await guest.getByLabel('Seu nome ou apelido').fill('Yuri');
  await guest.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await guest.getByText('Microfone ativo.', { exact: false }).waitFor();
  await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await host.getByText('Yuri', { exact: true }).waitFor();
  await guest.getByRole('button', { name: 'Ativar áudio de Nox', exact: true }).click();
  const waitForAudio = (page) =>
    page.waitForFunction(
      () =>
        [...document.querySelectorAll('audio')].some(
          (a) =>
            a.srcObject?.getAudioTracks().some((t) => t.readyState === 'live') && a.readyState >= 2,
        ),
      { timeout: 20000 },
    );
  await waitForAudio(host);
  await waitForAudio(guest);
  console.log('PASS: create, prejoin, two participants, remote audio');
  await host.screenshot({ path: 'test-artifacts/room.png' });
  const share = async (sender, receiver) => {
    await sender.getByRole('button', { name: 'Compartilhar tela', exact: true }).click();
    await sender.getByText('Você está compartilhando', { exact: true }).waitFor({ timeout: 15000 });
    await receiver.waitForFunction(
      () =>
        [...document.querySelectorAll('video')].some((v) => v.videoWidth > 0 && v.readyState >= 2),
      { timeout: 20000 },
    );
    await receiver.screenshot({ path: 'test-artifacts/stream.png' });
    await sender.getByRole('button', { name: 'Pausar transmissão', exact: true }).click();
    await receiver.getByText('pausou a transmissão', { exact: false }).waitFor();
    await sender.getByRole('button', { name: 'Retomar transmissão', exact: true }).click();
    await sender
      .getByRole('button', { name: 'Parar compartilhamento', exact: true })
      .first()
      .click();
    await receiver.getByText('Ninguém está compartilhando', { exact: true }).waitFor();
  };
  await share(host, guest);
  await share(guest, host);
  await share(host, guest);
  console.log('PASS: screen share, stop, change sharer, share again');
  await guest.reload();
  await guest.getByRole('button', { name: 'Entrar na sala', exact: true }).click();
  await guest.getByText('Ninguém está compartilhando', { exact: true }).waitFor();
  await share(host, guest);
  console.log('PASS: refresh and resume during session');
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.screenshot({ path: 'test-artifacts/mobile.png' });
  assert.equal(
    await guest.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await guest.getByRole('button', { name: 'Participantes', exact: true }).click();
  await guest.getByRole('dialog').waitFor();
  await guest.keyboard.press('Escape');
  await host.getByRole('button', { name: 'Configurações da chamada', exact: true }).click();
  await host.getByRole('tab', { name: 'Transmissão', exact: true }).click();
  await host.screenshot({ path: 'test-artifacts/settings.png' });
  await host.keyboard.press('Escape');
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
  ]) {
    await host.setViewportSize({ width, height });
    assert.equal(
      await host.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await host.getByRole('button', { name: 'Sair da sala', exact: true }).click();
  await host.getByRole('button', { name: 'Encerrar para todos', exact: true }).click();
  await guest.getByRole('heading', { name: 'Sala encerrada', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: mobile, settings, host ends room, no JavaScript exceptions');
} catch (err) {
  for (const [i, page] of pages.entries()) {
    await page.screenshot({ path: `test-artifacts/failure-${i}.png` });
    console.log(
      'FAILURE PAGE',
      i,
      await page
        .evaluate(async () => {
          const { useRoom } = await import('/src/stores/roomStore.ts');
          const { useMedia } = await import('/src/stores/mediaStore.ts');
          const { getSession } = await import('/src/services/session/RoomSession.ts');
          const peers = getSession()?.peers;
          return {
            room: useRoom.getState(),
            media: useMedia.getState(),
            links: peers?.peerIds.map((id) => {
              const l = peers.get(id);
              return {
                id,
                gen: l.generation,
                remoteGen: l.remoteGeneration,
                state: l.pc.connectionState,
                signaling: l.pc.signalingState,
                local: l.pc.localDescription,
                remote: l.pc.remoteDescription,
                transceivers: l.pc.getTransceivers().map((t) => ({
                  mid: t.mid,
                  dir: t.direction,
                  current: t.currentDirection,
                  sender: t.sender.track?.kind,
                  receiver: t.receiver.track?.kind,
                })),
              };
            }),
          };
        })
        .catch(() => ({ diagnostic: 'Source modules unavailable in production build' })),
    );
  }
  throw err;
} finally {
  await browser.close();
}
