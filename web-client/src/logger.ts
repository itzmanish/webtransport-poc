export class Logger {
    private env: 'dev' | 'prod';
    private output: HTMLDivElement;

    constructor(output: HTMLDivElement, env: 'dev' | 'prod' = 'dev') {
        this.env = env
        this.output = output;
    }

    public write(...msg: any[]) {
        if (this.env === 'dev') {
            console.debug(...msg)
        }
        const text: string = msg.reduce((acc, value) => {
            if (typeof value === 'object') {
                value = JSON.stringify(value, null, 2)
            }
            if (acc === "") {
                return value
            }
            return acc + " " + value
        }, '')
        this.output.appendChild(this.constructNode(text))
    }

    private constructNode(msg: string) {
        const node = document.createElement("div")
        node.innerText = msg
        return node
    }
}

