export default (command, args) => {
    console.log(`Invalid number of arguments: please use "oblecto ${command} ${args.map((a)=>`[${a}]`).join(' ')}"`);
};