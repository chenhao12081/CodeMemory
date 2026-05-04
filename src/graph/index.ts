import "dotenv/config";
import { ChatDeepSeek } from "@langchain/deepseek";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { AgentState } from "../state/global.ts";

const model = new ChatDeepSeek({
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY!,
})

const agentBuilder = new StateGraph(AgentState)
    .addNode('chatNode', async (state) => {
        const response = await model.invoke([
            ...state.messages,
            { role: 'user', content: state.intent },
        ])
        return {
            messages: [response],
        }
    })
    .addEdge(START, 'chatNode')
    .addEdge('chatNode', END);

const checkpointer = new MemorySaver();

const agent = agentBuilder.compile({
    checkpointer,
});

const config = {
    configurable: {
        thread_id: uuidv4(),
    }
}

const result = await agent.invoke({
    intent: '世界第二高峰在哪里',
}, config);
console.log(result);
// export default agent;
