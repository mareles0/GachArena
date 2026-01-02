// Tipagens mínimas para compatibilidade com Angular 12 / TypeScript 4.3.
// O pacote socket.io-client usa `exports` com `types`, mas o TS 4.3 não resolve isso bem.

declare module 'socket.io-client' {
  export interface Socket {
    id?: string;
    connected?: boolean;

    on(event: string, callback: (...args: any[]) => void): this;
    off(event?: string, callback?: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    disconnect(): this;
  }

  export interface ManagerOptions {
    transports?: string[];
    autoConnect?: boolean;
    reconnection?: boolean;
  }

  export interface SocketOptions {
    // Mantém espaço para opções adicionais sem quebrar builds
    [key: string]: any;
  }

  export function io(uri?: string, opts?: Partial<ManagerOptions & SocketOptions>): Socket;
}
