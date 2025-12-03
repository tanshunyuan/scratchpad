"use client";

import React, { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Plus, X, Send, Users, Bot, MessageSquare } from "lucide-react";
import { DefaultChatTransport, UIMessage } from "ai";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";

interface Advisor {
  id: string;
  name: string;
  expertise: string;
}

// Define your custom message type (optional but recommended)
type AdvisorData = { name: string; expertise: string };
type StatusData = { message: string; stage: string };

type CustomUIMessage = UIMessage<
  never,
  {
    advisor: AdvisorData;
    "advisor-header": {
      name: string;
      index: number;
      total: string;
      expertise: string;
    };
    status: StatusData;
    separator: never;
  }
>;

export default function AdvisorBoard() {
  const [advisors, setAdvisors] = useState<Advisor[]>([
    { id: "1", name: "Sarah Chen", expertise: "Product Strategy" },
    { id: "2", name: "Marcus Rivera", expertise: "Engineering & Architecture" },
    { id: "3", name: "Dr. Emily Watson", expertise: "Data Science & ML" },
  ]);
  const [newName, setNewName] = useState("");
  const [newExpertise, setNewExpertise] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedAdvisor, setSelectedAdvisor] = useState<AdvisorData | null>(
    null,
  );

  const { messages, sendMessage, status } = useChat<CustomUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat-mock",
      // api: "/api/chat",
    }),
    // onData: (part) => {
    //   if (part.type === "data-status") {
    //     setStatusMessage(part.data.message);
    //   }
    //   if (part.type === "data-advisor") {
    //     setSelectedAdvisor(part.data);
    //     // Clear status after advisor is selected (optional)
    //     if (part.data) setStatusMessage(null);
    //   }
    // },
  });

  const addAdvisor = () => {
    if (newName.trim() && newExpertise.trim()) {
      setAdvisors([
        ...advisors,
        {
          id: Date.now().toString(),
          name: newName.trim(),
          expertise: newExpertise.trim(),
        },
      ]);
      setNewName("");
      setNewExpertise("");
      setShowAddForm(false);
    }
  };

  const removeAdvisor = (id: Advisor["id"]) => {
    setAdvisors(advisors.filter((a) => a.id !== id));
  };

  const handleSendMessage = () => {
    if (inputValue.trim() && advisors.length > 0) {
      sendMessage({ text: inputValue }, { body: { advisors } });
      setInputValue("");
    }
  };

  // const onKeyDown = (e) => {
  //   if (e.key === "Enter" && !e.shiftKey) {
  //     e.preventDefault();
  //     handleSendMessage();
  //   }
  // };

  const isLoading = status === "streaming";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Board of Advisors
          </h1>
          <p className="text-purple-200">
            Your AI advisory panel for complex decisions
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Advisors ({advisors.length})
                </h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="p-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4 text-white" />
                </button>
              </div>

              {showAddForm && (
                <div className="mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAdvisor()}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 mb-2"
                  />
                  <input
                    type="text"
                    placeholder="Expertise"
                    value={newExpertise}
                    onChange={(e) => setNewExpertise(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAdvisor()}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 mb-2"
                  />
                  <button
                    onClick={addAdvisor}
                    className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white font-medium transition-colors"
                  >
                    Add Advisor
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {advisors.map((advisor) => (
                  <div
                    key={advisor.id}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-white">
                        {advisor.name}
                      </h3>
                      <button
                        onClick={() => removeAdvisor(advisor.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-purple-200">
                      {advisor.expertise}
                    </p>
                  </div>
                ))}
              </div>

              {advisors.length === 0 && (
                <p className="text-center text-white/50 py-8">
                  Add advisors to get started
                </p>
              )}
            </div>
          </div>
          {/*
          {(statusMessage || selectedAdvisor) && (
            <div className="max-w-4xl mx-auto mb-4 p-3 bg-purple-900/50 rounded-lg text-purple-200 text-sm">
              {statusMessage && <>🔍 {statusMessage}</>}
              {selectedAdvisor && (
                <>
                  🧠 Advisor: {selectedAdvisor.name} (
                  {selectedAdvisor.expertise})
                </>
              )}
            </div>
          )}*/}

          <div className="md:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 flex flex-col h-[1000px]">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <Conversation>
                  <ConversationContent>
                    {messages.length === 0 && (
                      <div className="text-center text-white/50 py-12">
                        <p className="text-lg mb-2">
                          Welcome to your Board of Advisors
                        </p>
                        <p className="text-sm">
                          Ask a complex question and your advisors will help you
                          think it through.
                        </p>
                      </div>
                    )}

                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.role === "user"
                              ? "bg-purple-500 text-white"
                              : "bg-white/10 text-white border border-white/20"
                          }`}
                        >
                          {msg.parts.map((part, i) => {
                            if (part.type === "text") {
                              return (
                                <p key={i} className="whitespace-pre-wrap">
                                  {part.text}
                                </p>
                              );
                            }

                            if (part.type === "data-advisor") {
                              return (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 text-xs bg-emerald-500/20 px-3 py-2 rounded-lg mb-2 border border-emerald-500/30"
                                >
                                  <Users className="w-3 h-3 text-emerald-300" />
                                  <span className="text-emerald-200">
                                    <span className="font-semibold">
                                      {part.data.name}
                                    </span>
                                    <span className="text-emerald-300/70">
                                      {" "}
                                      • {part.data.expertise}
                                    </span>
                                  </span>
                                </div>
                              );
                            }

                            if (part.type === "data-advisor-header") {
                              return (
                                <div
                                  key={i}
                                  className="mb-3 pb-2 border-b border-white/20"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-purple-200">
                                      {part.data.name}
                                    </span>
                                    <span className="text-xs text-white/50">
                                      {part.data.index} of {part.data.total}
                                    </span>
                                  </div>
                                  <div className="text-xs text-purple-300">
                                    {part.data.expertise}
                                  </div>
                                </div>
                              );
                            }

                            if (part.type === "data-separator") {
                              return (
                                <div
                                  key={i}
                                  className="my-4 border-t border-white/10"
                                ></div>
                              );
                            }

                            if (part.type === "data-status") {
                              return (
                                <div
                                  key={i}
                                  className="text-xs text-purple-300 italic flex items-center gap-2 mb-2"
                                >
                                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
                                  {part.data.message}
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white/10 text-white border border-white/20 rounded-2xl px-4 py-3">
                          <div className="flex gap-2">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              </div>

              <div className="p-4 border-t border-white/20">
                <PromptInput onSubmit={handleSendMessage} className="w-full">
                  <PromptInputTextarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask your board of advisors..."
                    disabled={isLoading || advisors.length === 0}
                    className="border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <PromptInputFooter>
                    <PromptInputSubmit
                      status={isLoading ? "streaming" : "ready"}
                      disabled={!inputValue.trim() || advisors.length === 0}
                      className="bg-purple-500 hover:bg-purple-600 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium transition-colors"
                    />
                  </PromptInputFooter>
                </PromptInput>
                {advisors.length === 0 && (
                  <p className="text-sm text-red-300 mt-2">
                    Add at least one advisor to start chatting
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
