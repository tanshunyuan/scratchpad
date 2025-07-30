import { Input } from "@base-ui-components/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useChat } from "ai/react";
import axios from "axios";
import isEmpty from "lodash-es/isEmpty";
import { CircleStopIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from 'react-markdown'
import z from "zod";

const startChatSchema = z.object({
  message: z.string().min(3)
})
type StartChatSchema = z.infer<typeof startChatSchema>


export default function StreamPage() {
  const [threadId, setThreadId] = useState<null | string>(null)
  const [messagesHistory, setMessagesHistory] = useState<{ role: 'user' | 'assistant', content: string, timestamp: number }[]>([])
  const [toggleFeedback, setToggleFeedback] = useState(false)
  const [isFinal, setIsFinal] = useState(false)

  const startChatForm = useForm<StartChatSchema>({
    resolver: zodResolver(startChatSchema)
  })

  const startChat = useChat({
    api: 'http://localhost:8000/stream/chat',
    onResponse: (response) => {
      console.log(`startChat.onResponse.response ==> `, response)
      //   setThreadId(response.body.data.threadId)
      //   setMessagesHistory(prev => {
      //     return [...prev,
      //     { role: 'assistant', content: data.data.response.question, timestamp: Date.now() },
      //     { role: 'assistant', content: data.data.response.plan.join('\n\n'), timestamp: Date.now() }
      //     ]
      //   })
    },
    onFinish: (message) => {
      console.log(`startChat.onFinish.message ==> `, message)
    }
  })

  const resetStartChat = () => startChatForm.reset()

  const startChatOnSubmit = (data: StartChatSchema) => {
    if (!isEmpty(threadId)) throw new Error(`Cannot start a new chat with an existing threadId!`);

    setMessagesHistory((prev) => {
      return [...prev, { role: 'user', content: data.message, timestamp: Date.now() }]
    })
    resetStartChat()

    startChat.append({
      role: 'user',
      content: data.message
    },
      {
        body: {
          message: data.message
        }
      }
    )
  }


  const isLoading = startChat.status === 'streaming' || startChat.status === 'submitted'

  return <main className="min-h-screen p-8 flex flex-col">
    <h1>Using `.streamEvents` method</h1>
    {/* main content */}
    <div className="flex-1 flex flex-col">
      {/* chat body */}
      <div>
        {messagesHistory.sort((a, b) => a.timestamp - b.timestamp).map((state, idx) => {
          const isYou = state.role === 'user'
          const isAssistant = state.role === 'assistant'
          return <div key={idx} className={`mb-2`}>
            {isYou ? <div className="p-4 bg-slate-400 text-right max-w-[32ch] ml-auto rounded-2xl rounded-tr-none">
              <p className="text-white">{state.content}</p>
            </div> : null}

            {isAssistant ? <div>
              <p className="font-bold">Assistant</p>
              <ReactMarkdown>{state.content}</ReactMarkdown>
            </div> : null}
          </div>
        })}
        {isLoading ? <p>loading...</p> : null}
      </div>
      {/* chat input */}
      <div className="mt-auto">
        {/* start chat */}
        {isEmpty(threadId) ?
          <>
            {
              !isLoading ?
                <>
                  <form
                    className={`
                    flex items-center space-x-4 border py-2 px-4 rounded-lg
                    ${startChatForm.formState.errors.message ? 'border-red-200' : 'border-gray-200'}
                    `}
                    onSubmit={startChatForm.handleSubmit(startChatOnSubmit)}>
                    <Input
                      {...startChatForm.register('message')}
                      placeholder="Message"
                      className={`
                      h-10 w-full pl-3.5 text-base text-gray-900 
                      focus:outline-none
                      `}
                      disabled={isLoading}
                    />
                    <button disabled={isLoading}>
                      <SendIcon />
                    </button>
                  </form>
                  {startChatForm.formState.errors.message?.message}
                </> :
                <div className="flex justify-center">
                  <CircleStopIcon className="animate-spin" />
                </div>
            }
          </>
          : null}

      </div>
    </div>
  </main>
}