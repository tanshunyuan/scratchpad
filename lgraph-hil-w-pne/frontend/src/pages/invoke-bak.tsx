import { Input } from "@base-ui-components/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import z from "zod";
import isEmpty from 'lodash-es/isEmpty'
import ReactMarkdown from 'react-markdown'
import { CircleStopIcon, SendIcon } from "lucide-react";


const schema = z
  .object({
    message: z.string().min(3)
  })
type Schema = z.infer<typeof schema>

const feedbackSchema = z.object({
  type: z.enum(['accept', 'feedback']),
  feedback: z.string().optional()
})
type FeedbackSchema = z.infer<typeof feedbackSchema>

const startChatMutation = () => useMutation({
  mutationFn: async (args: Schema) => {
    const response = await axios.post<{
      threadId: string,
      response: {
        question: string,
        plan: string[]
      }
    }>(
      'http://localhost:8000/invoke/chat',
      {
        message: args.message
      }
    )
    return response
  },
})

const resumeChatMutation = (outerArgs: { threadId: string | null }) => useMutation({
  mutationFn: async (args: FeedbackSchema) => {
    if (isEmpty(outerArgs.threadId)) throw new Error('Niet threadId')
    const response = await axios.post<{
      threadId: string,
      response: {
        question: string,
        plan: string[],
      } | string
      final: boolean
    }>(
      'http://localhost:8000/invoke/chat/resume',
      {
        threadId: outerArgs.threadId,
        type: args.type,
        ...(args.feedback ? { message: args.feedback } : {})
      }
    )
    return response
  },
})
export default function InvokePage() {
  const [threadId, setThreadId] = useState<null | string>(null)
  const [messageState, setMessageState] = useState<{ role: 'user' | 'assistant', content: string, timestamp: number }[]>([])
  const [toggleFeedback, setToggleFeedback] = useState(false)

  const schemaForm = useForm<Schema>({
    resolver: zodResolver(schema)
  })

  const feedbackSchemaForm = useForm<FeedbackSchema>({
    resolver: zodResolver(feedbackSchema)
  })

  const { mutate: startChatMutate, isPending: startChatPending } = startChatMutation()
  const { mutate: resumeChatMutate, isPending: resumeChatPending } = resumeChatMutation({ threadId })

  const schemaOnSubmit = (data: Schema) => {
    setToggleFeedback(false)
    feedbackSchemaForm.reset()
    if (isEmpty(threadId)) {
      setMessageState((prev) => {
        return [...prev, { role: 'user', content: data.message, timestamp: Date.now() }]
      })
      startChatMutate({ message: data.message }, {
        onSuccess: (data) => {
          setThreadId(data.data.threadId)
          setMessageState(prev => {
            return [...prev,
            { role: 'assistant', content: data.data.response.question, timestamp: Date.now() },
            { role: 'assistant', content: data.data.response.plan.join('\n\n'), timestamp: Date.now() }
            ]
          })
        },
        onSettled: () => {
          schemaForm.reset()
        }
      })
    }
  }

  const feedbackSchemaOnSubmit = (data: FeedbackSchema) => {
    console.log({ data })
    if (isEmpty(threadId)) console.log('cannot no threadId')

    if (data.feedback) {
      console.log('set le feedback')
      setMessageState((prev) => {
        return [...prev, { role: 'user', content: data.feedback!, timestamp: Date.now() }]
      })
    }

    resumeChatMutate({
      type: data.type,
      feedback: data.feedback
    }, {
      onSuccess: (data) => {
        setMessageState(prev => {
          if (typeof data.data.response === 'string') {
            return [...prev,
            { role: 'assistant', content: data.data.response, timestamp: Date.now() },
            ]
          } else {
            return [...prev,
            { role: 'assistant', content: data.data.response.question, timestamp: Date.now() },
            { role: 'assistant', content: data.data.response.plan.join('\n\n'), timestamp: Date.now() }
            ]
          }
        })
      },
      onSettled: () => {
        setToggleFeedback(false)
        feedbackSchemaForm.reset()
      }
    })
  }

  const isLoading = startChatPending || resumeChatPending

  return <main className="min-h-screen p-8 flex flex-col">
    <h1>Using `.invoke` method</h1>
    <div className="flex-1 flex flex-col">
      <div>
        {messageState.sort((a, b) => a.timestamp - b.timestamp).map((state, idx) => {
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

      <div className="mt-auto">
        {isEmpty(threadId) ?
          <>
            {
              !isLoading ?
                <>
                  <form className={`
              flex items-center space-x-4 border py-2 px-4 rounded-lg
              ${schemaForm.formState.errors.message ? 'border-red-200' : 'border-gray-200'}
              `} onSubmit={schemaForm.handleSubmit(schemaOnSubmit)}>
                    <Input
                      {...schemaForm.register('message')}
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
                  {schemaForm.formState.errors.message?.message}
                </> : <div className="flex justify-center">
                  <CircleStopIcon className="animate-spin" />
                </div>
            }
          </> : <>
            {!toggleFeedback ?
              <div className="flex items-center space-x-4" >
                <button onClick={() => feedbackSchemaOnSubmit({ type: 'accept' })} {...feedbackSchemaForm.register('type')}>Approve</button>
                <button onClick={() => setToggleFeedback(true)}>Feedback</button>
              </div> : <form onSubmit={feedbackSchemaForm.handleSubmit(feedbackSchemaOnSubmit)}>
                <textarea className="border border-slate-300 px-4 py-2 rounded-lg" {...feedbackSchemaForm.register('feedback')} />
                <div className="space-x-4" >
                  <button onClick={() => setToggleFeedback(false)}>Cancel</button>
                  <button type="submit" {...feedbackSchemaForm.register('type')} onClick={() => feedbackSchemaForm.setValue('type', 'feedback')}>Submit</button>
                </div>
              </form>
            }
            {feedbackSchemaForm.formState.errors.feedback?.message}
            {feedbackSchemaForm.formState.errors.type?.message}
          </>
        }
      </div>
    </div>
  </main>
}
