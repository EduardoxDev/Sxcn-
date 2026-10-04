import type { ErrorCode } from '@scxn/shared';

export type AppErrorKind =
  | 'room-not-found'
  | 'room-ended'
  | 'room-full'
  | 'room-limit'
  | 'kicked'
  | 'invalid-code'
  | 'mic-blocked'
  | 'mic-unavailable'
  | 'mic-busy'
  | 'screen-blocked'
  | 'screen-unsupported'
  | 'screen-timeout'
  | 'browser-unsupported'
  | 'webrtc-failed'
  | 'signaling-failed'
  | 'connection-lost'
  | 'rate-limited'
  | 'unknown';

export interface ErrorCopy {
  title: string;
  description: string;
}

/** User-facing copy. Every message explains what happened and how to fix it. */
export const ERROR_COPY: Record<AppErrorKind, ErrorCopy> = {
  'room-not-found': {
    title: 'Sala não encontrada',
    description: 'Confira se o código está correto. Salas sem ninguém expiram após alguns minutos.',
  },
  'room-ended': {
    title: 'Sala encerrada',
    description:
      'Esta sessão foi encerrada pelo host ou expirou. Crie uma nova sala para continuar.',
  },
  'room-full': {
    title: 'Sala cheia',
    description:
      'Esta sala atingiu o limite de participantes. Peça para alguém sair ou crie outra sala.',
  },
  'room-limit': {
    title: 'Servidor no limite',
    description: 'Não é possível criar novas salas agora. Tente novamente em alguns minutos.',
  },
  kicked: {
    title: 'Você foi removido da sala',
    description: 'O host removeu você desta sessão.',
  },
  'invalid-code': {
    title: 'Código inválido',
    description: 'Use o formato XXXX-XXXX, por exemplo HG3V-WPST, ou cole o link de convite.',
  },
  'mic-blocked': {
    title: 'Não foi possível acessar seu microfone',
    description:
      'Permita o acesso ao microfone nas configurações do navegador (ícone de cadeado na barra de endereço) e tente novamente.',
  },
  'mic-unavailable': {
    title: 'Nenhum microfone encontrado',
    description:
      'Conecte um microfone e tente novamente. Você também pode entrar apenas para ouvir.',
  },
  'mic-busy': {
    title: 'Microfone em uso',
    description: 'Outro aplicativo está usando o microfone. Feche-o ou escolha outro dispositivo.',
  },
  'screen-blocked': {
    title: 'Compartilhamento bloqueado',
    description:
      'O sistema bloqueou a captura de tela. No macOS, permita o navegador em Ajustes do Sistema → Privacidade → Gravação de Tela.',
  },
  'screen-unsupported': {
    title: 'Compartilhamento indisponível',
    description:
      'Este navegador não permite compartilhar a tela. Use Chrome, Edge, Firefox ou Safari no computador.',
  },
  'screen-timeout': {
    title: 'O seletor de tela não respondeu',
    description: 'Nenhuma tela foi escolhida a tempo. Tente compartilhar novamente.',
  },
  'browser-unsupported': {
    title: 'Navegador incompatível',
    description:
      'A Scxn precisa de WebRTC. Use uma versão recente do Chrome, Edge, Firefox ou Safari, em uma conexão HTTPS.',
  },
  'webrtc-failed': {
    title: 'Falha na conexão de mídia',
    description:
      'Não foi possível estabelecer a conexão direta. Redes corporativas ou VPNs podem bloquear WebRTC — tente outra rede.',
  },
  'signaling-failed': {
    title: 'Não foi possível conectar ao servidor',
    description: 'Verifique sua conexão com a internet e tente novamente.',
  },
  'connection-lost': {
    title: 'Conexão perdida',
    description:
      'Não conseguimos restabelecer a conexão com a sala. Verifique sua internet e tente novamente.',
  },
  'rate-limited': {
    title: 'Muitas tentativas',
    description: 'Aguarde alguns segundos antes de tentar novamente.',
  },
  unknown: {
    title: 'Algo deu errado',
    description: 'Ocorreu um erro inesperado. Tente novamente.',
  },
};

export function kindFromServerCode(code: ErrorCode | string): AppErrorKind {
  switch (code) {
    case 'ROOM_NOT_FOUND':
      return 'room-not-found';
    case 'ROOM_ENDED':
      return 'room-ended';
    case 'ROOM_FULL':
      return 'room-full';
    case 'ROOM_LIMIT':
      return 'room-limit';
    case 'RATE_LIMITED':
      return 'rate-limited';
    case 'TIMEOUT':
    case 'DISCONNECTED':
      return 'signaling-failed';
    default:
      return 'unknown';
  }
}

/** Error thrown by signaling requests (server rejection, timeout or transport failure). */
export class SignalingError extends Error {
  constructor(
    public readonly code: ErrorCode | 'TIMEOUT' | 'DISCONNECTED',
    message: string,
  ) {
    super(message);
    this.name = 'SignalingError';
  }
}
