"use client";

import React, { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Plus, X, Send, Users } from "lucide-react";
import { DefaultChatTransport } from "ai";

interface Advisor {
  id: string;
  name: string;
  expertise: string;
}

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

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat-mock",
    }),
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

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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

          <div className="md:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 flex flex-col h-[600px]">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
              </div>

              <div className="p-6 border-t border-white/20">
                <div className="flex gap-3">
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask your board of advisors..."
                    disabled={isLoading || advisors.length === 0}
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      isLoading || !inputValue.trim() || advisors.length === 0
                    }
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-white/10 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
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
