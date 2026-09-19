declare module 'guessit-exec';
declare module 'node-tvdb';
declare module 'neo-blessed' {
    // Only the surface used by src/core/graphical.ts
    interface Element {
        setLabel(label: string): void;
    }

    interface List extends Element {
        addItem(item: string): void;
        clearItems(): void;
        down(offset: number): void;
    }

    interface Screen {
        title: string;
        append(element: Element): void;
        render(): void;
        destroy(): void;
    }

    interface ListOptions {
        top?: number | string;
        left?: number | string;
        width?: number | string;
        height?: number | string;
        content?: string;
        label?: string;
        tags?: boolean;
        border?: { type: 'line' | 'bg' };
    }

    const blessed: {
        screen(options?: { smartCSR?: boolean }): Screen;
        list(options?: ListOptions): List;
    };

    export default blessed;
}
declare module 'node-rsa' {
    // Only the surface federation uses
    export default class NodeRSA {
        constructor(key?: string | Buffer | { b: number });
        encrypt(data: string | Buffer, encoding: 'base64'): string;
        decrypt(data: string | Buffer, encoding: 'ascii' | 'utf8'): string;
        exportKey(format: 'pkcs1-private-pem' | 'pkcs1-public-pem'): string;
    }
}