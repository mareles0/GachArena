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
    [key: string]: any;
  }

  export function io(uri?: string, opts?: Partial<ManagerOptions & SocketOptions>): Socket;
}
