import { Input } from "@base-ui-components/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useChat } from "ai/react";
import isEmpty from "lodash-es/isEmpty";
import { CircleStopIcon, SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from 'react-markdown'
import z from "zod";
import { nanoid } from "nanoid";

const startChatSchema = z.object({
  message: z.string().min(3)
})
type StartChatSchema = z.infer<typeof startChatSchema>

const resumeChatSchema = z.object({
  type: z.enum(['accept', 'feedback']),
  feedback: z.string().optional()
})
type ResumeChatSchema = z.infer<typeof resumeChatSchema>

export default function StreamPage() {
  const [threadId, setThreadId] = useState<null | string>(null)
  const [messagesHistory, setMessagesHistory] = useState<{ role: 'user' | 'assistant', content: string, timestamp: number }[]>([])
  const [toggleFeedback, setToggleFeedback] = useState(false)
  const [isFinal, setIsFinal] = useState(false)

  const startChatForm = useForm<StartChatSchema>({
    resolver: zodResolver(startChatSchema)
  })

  const resumeChatForm = useForm<ResumeChatSchema>({
    resolver: zodResolver(resumeChatSchema)
  })

  const chat = useChat({
    api: 'http://localhost:8000/stream/chat/new',
    // onResponse: (response) => {
    //   console.log(`startChat.onResponse.response ==> `, response)
    // },
    onFinish: (message) => {
      console.log(`startChat.onFinish.message ==> `, message)
      resetResumeChat()
    },
    onError: (error) => {
      console.log(`chat.onError.error ==> `, error)
    },
  })



  const resetStartChat = () => startChatForm.reset()
  const resetResumeChat = () => {
    setToggleFeedback(false)
    resumeChatForm.reset()
  }

  const startChatOnSubmit = (data: StartChatSchema) => {
    if (!isEmpty(threadId)) throw new Error(`Cannot start a new chat with an existing threadId!`);

    setMessagesHistory((prev) => {
      return [...prev, { role: 'user', content: data.message, timestamp: Date.now() }]
    })
    resetStartChat()

    chat.append({
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

  const resumeChatOnSubmit = (data: ResumeChatSchema) => {
    if (isEmpty(threadId)) throw new Error(`Cannot resume a chat without a threadId!`);
    chat.setData(undefined)

    if (data.feedback) {
      console.log('adding user feedback to chat...')
      chat.setMessages((prev) => {
        return [...prev, { role: "user", content: data.feedback!, id: nanoid() }]
      })
    }

    chat.append({
      role: 'user',
      content: `${data.type}`
    },
      {
        body: {
          threadId,
          type: data.type,
          ...(data.feedback ? { message: data.feedback } : {})
        }
      }
    )

  }

  useEffect(() => {
    if (isEmpty(chat.data)) return
    chat.data!.forEach(rawItem => {
      if (isEmpty(rawItem)) return
      const item = rawItem!.valueOf()

      if (typeof item === 'object' && Object.hasOwn(item, 'threadId')) {
        console.log('startChat setting threadId')
        setThreadId((item as { threadId: string }).threadId)
      }

      if (typeof item === 'object' && Object.hasOwn(item, 'final')) {
        setIsFinal((item as { final: boolean }).final)
      }

      if (typeof item === 'object' && Object.hasOwn(item, 'response')) {
        const data = item as {
          response: {
            question: string,
            plan: string[],
          } | string
        }

        chat.setMessages(prev => {
          if (typeof data.response === 'string') {
            return [...prev,
            { role: 'assistant', content: data.response, id: nanoid() },
            ]
          } else {
            return [...prev,
            { role: 'assistant', content: data.response.question, id: nanoid() },
            { role: 'assistant', content: data.response.plan.join('\n\n'), id: nanoid() }
            ]
          }
        })
      }
    })
  }, [chat.data, chat.setMessages])

  const isLoading =
    chat.status === 'streaming' || chat.status === 'submitted'

  return <main className="min-h-screen p-8 flex flex-col">
    <h1>Using `.streamEvents` method</h1>
    {/* main content */}
    <div className="flex-1 flex flex-col">
      {/* chat body */}
      <div>
        {
          chat.messages.map(m => {
            return <div key={m.id}>
              {m.role === 'user' && !isEmpty(m.content) ? <div className="p-4 bg-slate-400 text-right max-w-[32ch] ml-auto rounded-2xl rounded-tr-none">
                <p className="text-white">{m.content}</p>
              </div> : null}

              {m.role === 'assistant' && !isEmpty(m.content) ? <div>
                <strong>Assistant</strong>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div> : null}
              <br />
            </div>
          })
        }
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

        {!isFinal && !isEmpty(threadId) && !isLoading ? <>
          {!toggleFeedback ?
            <div className="flex items-center space-x-4" >
              <button onClick={() => resumeChatOnSubmit({ type: 'accept' })} {...resumeChatForm.register('type')}>Approve</button>
              <button onClick={() => setToggleFeedback(true)}>Feedback</button>
            </div> :
            <form onSubmit={resumeChatForm.handleSubmit(resumeChatOnSubmit)}>
              <textarea className="border border-slate-300 px-4 py-2 rounded-lg" {...resumeChatForm.register('feedback')} />
              <div className="space-x-4" >
                <button onClick={() => setToggleFeedback(false)}>Cancel</button>
                <button type="submit" {...resumeChatForm.register('type')} onClick={() => resumeChatForm.setValue('type', 'feedback')}>Submit</button>
              </div>
            </form>
          }
        </> : null}
      </div>
    </div>
  </main>
}


