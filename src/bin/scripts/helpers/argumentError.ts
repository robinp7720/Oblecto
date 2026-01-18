export default (command: string, args: string[]): void => {
    console.log(`Invalid number of arguments: please use "oblecto ${command} ${args.map((a) => `[${a}]`).join(' ')}"`);
};
