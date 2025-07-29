import { Input } from "@base-ui-components/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import z from "zod";
import isEmpty from 'lodash-es/isEmpty'
import ReactMarkdown from 'react-markdown'


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
export default function InvokePage() {
  const [threadId, setThreadId] = useState<null | string>(null)
  const [messageState, setMessageState] = useState<{ role: 'user' | 'assistant', content: string, timestamp: number }[]>([
    // {
    //   role: 'user',
    //   content: 'hi',
    //   timestamp: Date.now()
    // },
    // { role: 'assistant', content: 'bye \n\n hahaha', timestamp: Date.now() + 1 }
  ])
  const schemaForm = useForm<Schema>({
    resolver: zodResolver(schema)
  })

  const feedbackSchemaForm = useForm<FeedbackSchema>({
    resolver: zodResolver(feedbackSchema)
  })

  const { mutate: startChatMutate, isPending: startChatPending } = startChatMutation()

  const schemaOnSubmit = (data: Schema) => {
    if (isEmpty(threadId)) {
      setMessageState((prev) => {
        return [...prev, { role: 'user', content: data.message, timestamp: Date.now() }]
      })
      schemaForm.resetField('message')
      startChatMutate({ message: data.message }, {
        onSuccess: (data) => {
          setThreadId(data.data.threadId)
          setMessageState(prev => {
            return [...prev,
            { role: 'assistant', content: data.data.response.question, timestamp: Date.now() },
            { role: 'assistant', content: data.data.response.plan.join('\n\n'), timestamp: Date.now() }
            ]
          })
        }
      })
    }
  }

  const feedbackSchemaOnSubmit = (data: FeedbackSchema) => {

  }

  const isLoading = startChatPending

  return <main className="min-h-screen p-8 flex flex-col">
    <h1>Invoking stuff</h1>
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
            {isLoading ? <p>loading...</p> : null}
          </div>
        })}
      </div>

      <div className="mt-auto">
        {isEmpty(threadId) ?
          <>
            <form className="flex items-center space-x-4" onSubmit={schemaForm.handleSubmit(schemaOnSubmit)}>
              <Input
                {...schemaForm.register('message')}
                placeholder="Message"
                className={`
            h-10 w-full rounded-md border ${schemaForm.formState.errors.message ? 'border-red-200' : 'border-gray-200'} pl-3.5 text-base text-gray-900 
            focus:outline focus:outline-2 focus:-outline-offset-1 ${schemaForm.formState.errors.message ? 'focus:outline-red-800' : 'focus:outline-blue-800'}
            `}
                disabled={isLoading}
              />
              <button disabled={isLoading}>
                Send
              </button>
            </form>
            {schemaForm.formState.errors.message?.message}
          </> : <>
            <form className="flex items-center space-x-4" >
              <button onClick={() => feedbackSchemaOnSubmit({ type: 'accept' })} {...feedbackSchemaForm.register('type')}>Approve</button>
            </form>
            {feedbackSchemaForm.formState.errors.feedback?.message}
          </>
        }
      </div>
    </div>
  </main>
}
