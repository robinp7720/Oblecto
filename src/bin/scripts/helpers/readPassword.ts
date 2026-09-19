import readline from 'readline';

const ENTER = new Set(['\r', '\n']);
const CTRL_C = String.fromCharCode(3);
const BACKSPACE = new Set([String.fromCharCode(8), String.fromCharCode(127)]);

/**
 * A password from the terminal without echoing it, asked twice to catch typos. When input is not a
 * terminal (a script piping it in), the first line of standard input.
 * @param prompt - What to ask for
 */
export async function readPassword(prompt = 'Password: '): Promise<string> {
    if (!process.stdin.isTTY) {
        const lines = readline.createInterface({ input: process.stdin });

        for await (const line of lines) {
            lines.close();
            return line;
        }

        return '';
    }

    const first = await askHidden(prompt);
    const second = await askHidden('Repeat it: ');

    if (first !== second) throw new Error('The passwords did not match');

    return first;
}

function askHidden(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;
        let value = '';

        const done = (error?: Error): void => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener('data', onData);
            process.stdout.write('\n');
            if (error) reject(error);
            else resolve(value);
        };

        const onData = (chunk: string): void => {
            for (const char of chunk) {
                if (ENTER.has(char)) return done();
                if (char === CTRL_C) return done(new Error('Cancelled'));
                if (BACKSPACE.has(char)) value = value.slice(0, -1);
                else value += char;
            }
        };

        process.stdout.write(prompt);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.on('data', onData);
    });
}

/**
 * The password given on the command line, or, when it is missing or "-", one read without
 * showing it. Passwords typed as arguments end up in shell history and process lists.
 * @param value - The password argument, if any
 */
export async function passwordArgument(value: string | undefined): Promise<string> {
    if (value !== undefined && value !== '-') {
        console.log('Note: a password given as an argument is visible in shell history and to other users. Use "-" to be asked for it instead.');
        return value;
    }

    return readPassword();
}
