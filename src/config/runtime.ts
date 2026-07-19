import "dotenv/config";

export const DEFAULT_OLLAMA_CHAT_MODEL = "qwen2.5-intent-q4";
export const DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-v4-pro";

export type RuntimeOptions = {
    model: string;
    chatModel: string;
    positional: string[];
};

export function parseRuntimeOptions(
    args: readonly string[] = process.argv.slice(2),
): RuntimeOptions {
    let modelFromCli: string | undefined;
    const positional: string[] = [];

    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];

        if (argument === "--model") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error("--model 需要提供模型名称，例如：--model qwen2.5");
            }
            modelFromCli = value;
            index += 1;
            continue;
        }

        if (argument.startsWith("--model=")) {
            const value = argument.slice("--model=".length);
            if (!value) {
                throw new Error("--model 需要提供模型名称，例如：--model=qwen2.5");
            }
            modelFromCli = value;
            continue;
        }

        positional.push(argument);
    }

    return {
        model: modelFromCli || process.env.OLLAMA_CHAT_MODEL || DEFAULT_OLLAMA_CHAT_MODEL,
        chatModel: process.env.DEEPSEEK_CHAT_MODEL || DEFAULT_DEEPSEEK_CHAT_MODEL,
        positional,
    };
}

export const runtimeOptions = parseRuntimeOptions();
