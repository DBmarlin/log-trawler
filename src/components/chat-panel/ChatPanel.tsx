import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, Settings, Copy, Check, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { marked } from "marked";
import { encodingForModel } from "js-tiktoken";
import { getModelPricing } from "./pricing";

type AIProvider = "openai" | "openrouter";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
  tokens?: {
    prompt: number;
    completion: number;
    cost: number;
  };
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRequest: () => void;
  initialPrompt?: string | null;
}

// List of some popular OpenRouter models
const openRouterModels = [
  "openai/gpt-3.5-turbo",
  "openai/gpt-4o",
  "openai/gpt-4-turbo",
  "openai/gpt-4.1",
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1-nano",
  "google/gemini-pro-1.5",
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-haiku",
];

// List of common OpenAI models
const openaiModels = [
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-3.5-turbo",
];

// Custom markdown renderer with copy button for code blocks
const renderMarkdown = (content: string, messageId?: string) => {
  try {
    const renderer = new marked.Renderer();

    renderer.code = function ({ text, lang, escaped }) {
      const codeText = typeof text === "string" ? text : String(text || "");
      const language = lang || "";
      const escapedCode = escaped
        ? codeText
        : codeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

      const codeId = `code-${messageId || Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      return `
        <div class="relative">
          <pre><code id="${codeId}" class="${language ? `language-${language}` : ""}">${escapedCode}</code></pre>
          <button 
            class="absolute top-2 right-2 bg-primary/10 hover:bg-primary/20 text-primary p-1 rounded"
            onclick="document.dispatchEvent(new CustomEvent('copyCode', {detail: {id: '${codeId}'}}))">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
        </div>
      `;
    };

    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: true,
    });

    const result = marked.parse(content);
    return typeof result === "string" ? result : String(result);
  } catch (error) {
    console.error("Error rendering markdown:", error);
    return content;
  }
};

const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  onOpenRequest,
  initialPrompt,
}) => {
  // State for copy functionality
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  
  // State for token counting and cost calculation
  const [totalCost, setTotalCost] = useState<number>(0);
  
  const [messages, setMessages] = useState<Message[]>([]);
  
  // AbortController for streaming
  const abortControllerRef = useRef<AbortController | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State for API settings
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [selectedOpenaiModel, setSelectedOpenaiModel] = useState<string>(openaiModels[0]);
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>(openRouterModels[0]);

  // Temporary state for settings dialog
  const [tempProvider, setTempProvider] = useState<AIProvider>(aiProvider);
  const [tempOpenaiKey, setTempOpenaiKey] = useState(openaiApiKey);
  const [tempOpenRouterKey, setTempOpenRouterKey] = useState(openRouterApiKey);
  const [tempOpenaiModel, setTempOpenaiModel] = useState(selectedOpenaiModel);
  const [tempOpenRouterModel, setTempOpenRouterModel] = useState(selectedOpenRouterModel);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedProvider = (localStorage.getItem("ai_provider") || "openai") as AIProvider;
    const savedOpenaiKey = localStorage.getItem("openai_api_key") || "";
    const savedOpenRouterKey = localStorage.getItem("openrouter_api_key") || "";
    const savedOpenaiModel = localStorage.getItem("openai_model");
    const savedOpenRouterModel = localStorage.getItem("openrouter_model");

    setAiProvider(savedProvider);
    setOpenaiApiKey(savedOpenaiKey);
    setOpenRouterApiKey(savedOpenRouterKey);

    if (savedOpenaiModel && openaiModels.includes(savedOpenaiModel)) {
      setSelectedOpenaiModel(savedOpenaiModel);
    }
    if (savedOpenRouterModel && openRouterModels.includes(savedOpenRouterModel)) {
      setSelectedOpenRouterModel(savedOpenRouterModel);
    }

    setTempProvider(savedProvider);
    setTempOpenaiKey(savedOpenaiKey);
    setTempOpenRouterKey(savedOpenRouterKey);
    setTempOpenaiModel(savedOpenaiModel || openaiModels[0]);
    setTempOpenRouterModel(savedOpenRouterModel || openRouterModels[0]);
  }, []);

  // Get current API key based on provider
  const getCurrentApiKey = () => {
    return aiProvider === "openai" ? openaiApiKey : openRouterApiKey;
  };

  // Copy to clipboard function
  const copyToClipboard = (text: string, setCopied: (value: any) => void, value: any) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(value);
          setTimeout(() => setCopied(null), 2000);
        })
        .catch(err => console.error('Clipboard write failed:', err));
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(value);
        setTimeout(() => setCopied(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };
  
  // Listen for code copy events
  useEffect(() => {
    const handleCopyCode = (e: CustomEvent<{id: string}>) => {
      const codeElement = document.getElementById(e.detail.id);
      if (codeElement) {
        copyToClipboard(codeElement.textContent || '', setCopiedCodeId, e.detail.id);
      }
    };
    
    document.addEventListener('copyCode', handleCopyCode as EventListener);
    return () => {
      document.removeEventListener('copyCode', handleCopyCode as EventListener);
    };
  }, []);
  
  // Function to count tokens
  const countTokens = (text: string, model: string): number => {
    try {
      const modelForEncoding = ["gpt-3.5-turbo", "gpt-4"].includes(model) ? model : "gpt-3.5-turbo";
      const enc = encodingForModel(modelForEncoding as any);
      const tokens = enc.encode(text).length;
      return tokens;
    } catch (e) {
      console.error("Error counting tokens:", e);
      return Math.ceil(text.length / 4); // Fallback estimate
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus the input field when the panel opens and API key is set
  useEffect(() => {
    const currentKey = getCurrentApiKey();
    if (isOpen && textareaRef.current && currentKey) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300); // Small delay
    }
  }, [isOpen, aiProvider, openaiApiKey, openRouterApiKey]);

  // Effect to handle the initial prompt
  useEffect(() => {
    if (isOpen && initialPrompt && textareaRef.current) {
      setInput(initialPrompt);
      textareaRef.current.focus(); // Focus after setting value
    }
  }, [isOpen, initialPrompt]);

  // Listen for custom event to open chat with a prompt
  useEffect(() => {
    const handleOpenChatWithPrompt = (
      event: CustomEvent<{ prompt: string; autoSubmit?: boolean }>
    ) => {
      // Directly request the parent to open the panel
      onOpenRequest();
      
      const currentKey = getCurrentApiKey();
      const promptText = event.detail.prompt;
      
      // Auto-submit the question if autoSubmit is true and we have an API key
      if (event.detail.autoSubmit && currentKey && promptText) {
        // Create and send the message directly without using the input state
        const userMessage: Message = { role: "user", content: promptText };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        
        // Call API with the message
        const messagesToSend = [...messages, userMessage];
        const apiEndpoint = aiProvider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentKey}`,
        };

        if (aiProvider === "openrouter") {
          headers["HTTP-Referer"] = `${window.location.origin}`;
          headers["X-Title"] = "Log Trawler AI Assistant";
        }

        const modelToUse = aiProvider === "openai" ? selectedOpenaiModel : selectedOpenRouterModel;
        const body = JSON.stringify({
          model: modelToUse,
          messages: messagesToSend,
          temperature: 0.7,
          stream: true
        });

        setIsLoading(true);
        
        // Use setTimeout to ensure the UI updates before making the API call
        setTimeout(async () => {
          try {
            const abortController = new AbortController();
            abortControllerRef.current = abortController;
            
            const response = await fetch(apiEndpoint, {
              method: "POST",
              headers: headers,
              body: body,
              signal: abortController.signal
            });

            if (!response.ok || !response.body) {
              const errorData = await response.text();
              throw new Error(`API error: ${response.status} - ${errorData}`);
            }

            // Create a new assistant message with empty content and unique ID
            const assistantMessageId = Date.now().toString();
            const assistantMessage: Message = {
              role: "assistant",
              content: "",
              id: assistantMessageId
            };
            setMessages((prevMessages) => [...prevMessages, assistantMessage]);
            
            // Process the stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";
            
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                  if (!line.trim() || !line.startsWith('data:')) continue;
                  
                  const data = line.replace(/^data:\s*/, '');
                  if (data === '[DONE]') break;
                  
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content || '';
                    
                    if (delta) {
                      accumulatedContent += delta;
                      
                      // Update the message content incrementally
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { ...msg, content: accumulatedContent } 
                          : msg
                      ));
                    }
                  } catch (e) {
                    console.error("Error parsing streaming data:", e);
                  }
                }
              }
              
              // Calculate tokens and cost after streaming is complete
              const messagesText = messagesToSend.map(m => m.content).join("\n");
              const promptTokens = countTokens(messagesText, modelToUse);
              const completionTokens = countTokens(accumulatedContent, modelToUse);
              
              // Get pricing
              const pricing = getModelPricing(modelToUse);
              
              // Calculate cost
              const cost = 
                (promptTokens * pricing.input_cost_per_1k_tokens / 1000) +
                (completionTokens * pricing.output_cost_per_1k_tokens / 1000);
              
              // Update message with token and cost info
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { 
                      ...msg, 
                      tokens: {
                        prompt: promptTokens,
                        completion: completionTokens,
                        cost: cost
                      }
                    } 
                  : msg
              ));
              
              // Update total cost
              setTotalCost(prev => prev + cost);
              
            } catch (streamError: any) {
              if (streamError.name !== 'AbortError') {
                console.error("Error processing stream:", streamError);
                throw streamError;
              }
            }
          } catch (error) {
            console.error(`Error calling ${aiProvider} API:`, error);
            let errorMessage = `Error with ${aiProvider} API. Please check your settings.`;
            
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                role: "assistant",
                content: errorMessage,
              },
            ]);
          } finally {
            setIsLoading(false);
          }
        }, 300);
      } else {
        // Just set the input for manual sending
        setInput(promptText);
      }
    };

    // Add event listener
    document.addEventListener(
      "openChatWithPrompt",
      handleOpenChatWithPrompt as EventListener
    );

    // Clean up
    return () => {
      document.removeEventListener(
        "openChatWithPrompt",
        handleOpenChatWithPrompt as EventListener
      );
    };
  }, [onOpenRequest, getCurrentApiKey, aiProvider, selectedOpenaiModel, selectedOpenRouterModel, messages]);

  const saveSettings = () => {
    setAiProvider(tempProvider);
    setOpenaiApiKey(tempOpenaiKey);
    setOpenRouterApiKey(tempOpenRouterKey);
    setSelectedOpenaiModel(tempOpenaiModel);
    setSelectedOpenRouterModel(tempOpenRouterModel);

    localStorage.setItem("ai_provider", tempProvider);
    localStorage.setItem("openai_api_key", tempOpenaiKey);
    localStorage.setItem("openrouter_api_key", tempOpenRouterKey);
    localStorage.setItem("openai_model", tempOpenaiModel);
    localStorage.setItem("openrouter_model", tempOpenRouterModel);

    setSettingsOpen(false);
  };

  const sendMessage = async () => {
    const currentKey = getCurrentApiKey();
    if (!input.trim() || !currentKey) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);

    const messagesToSend = [...messages, userMessage];
    const apiEndpoint = aiProvider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentKey}`,
    };

    if (aiProvider === "openrouter") {
      headers["HTTP-Referer"] = `${window.location.origin}`;
      headers["X-Title"] = "Log Trawler AI Assistant";
    }

    const modelToUse = aiProvider === "openai" ? selectedOpenaiModel : selectedOpenRouterModel;
    const body = JSON.stringify({
      model: modelToUse,
      messages: messagesToSend,
      temperature: 0.7,
      stream: true
    });

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: headers,
        body: body,
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} - ${errorData}`);
      }

      // Create a new assistant message with empty content and unique ID
      const assistantMessageId = Date.now().toString();
      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        id: assistantMessageId
      };
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      
      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data:')) continue;
            
            const data = line.replace(/^data:\s*/, '');
            if (data === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              
              if (delta) {
                accumulatedContent += delta;
                
                // Update the message content incrementally
                setMessages(prev => prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: accumulatedContent } 
                    : msg
                ));
              }
            } catch (e) {
              console.error("Error parsing streaming data:", e);
            }
          }
        }
        
        // Calculate tokens and cost after streaming is complete
        const messagesText = messagesToSend.map(m => m.content).join("\n");
        const promptTokens = countTokens(messagesText, modelToUse);
        const completionTokens = countTokens(accumulatedContent, modelToUse);
        
        // Get pricing
        const pricing = getModelPricing(modelToUse);
        
        // Calculate cost
        const cost = 
          (promptTokens * pricing.input_cost_per_1k_tokens / 1000) +
          (completionTokens * pricing.output_cost_per_1k_tokens / 1000);
        
        // Update message with token and cost info
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { 
                ...msg, 
                tokens: {
                  prompt: promptTokens,
                  completion: completionTokens,
                  cost: cost
                }
              } 
            : msg
        ));
        
        // Update total cost
        setTotalCost(prev => prev + cost);
        
      } catch (streamError: any) {
        if (streamError.name !== 'AbortError') {
          console.error("Error processing stream:", streamError);
          throw streamError;
        }
      }
    } catch (error) {
      console.error(`Error calling ${aiProvider} API:`, error);
      let errorMessage = `Error with ${aiProvider} API. Please check your settings.`;
      
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const isApiKeySet = () => {
    return aiProvider === "openai" ? !!openaiApiKey : !!openRouterApiKey;
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[675px] bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="flex flex-col h-full">
        <style>{`
          .markdown-content a {
            color: #3b82f6;
            text-decoration: underline;
          }
          .markdown-content table {
            border-collapse: collapse;
            margin: 10px 0;
            width: 100%;
          }
          .markdown-content th,
          .markdown-content td {
            border: 1px solid #374151;
            padding: 6px 10px;
          }
          .markdown-content th {
            background-color: #1f2937;
          }
          .markdown-content hr {
            border: 0;
            border-top: 1px solid #374151;
            margin: 10px 0;
          }
          .markdown-content img {
            max-width: 100%;
            height: auto;
          }
          .markdown-content code {
            color: var(--foreground);
            background-color: var(--muted);
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 0.875rem;
            font-family: monospace;
          }
          .markdown-content pre {
            background-color: #2d3748;
            border-radius: 4px;
            padding: 8px;
            overflow-x: auto;
            margin: 8px 0;
            border-left: 3px solid #4f46e5;
            max-width: 100%;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .markdown-content pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            color: #e5e7eb;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .markdown-content p {
            margin-bottom: 0.5rem;
          }
          .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          .markdown-content h1 {
            font-size: 1.25rem;
          }
          .markdown-content h2 {
            font-size: 1.125rem;
          }
          .markdown-content h3 {
            font-size: 1rem;
          }
          .markdown-content ul {
            list-style-type: disc;
            padding-left: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content ol {
            list-style-type: decimal;
            padding-left: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .markdown-content li {
            margin-bottom: 0.25rem;
          }
          .markdown-content blockquote {
            border-left-width: 4px;
            border-left-color: #6b7280;
            padding-left: 1rem;
            font-style: italic;
            margin: 0.5rem 0;
          }
        `}</style>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-medium">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-2">
            {totalCost > 0 && (
              <div className="flex items-center text-xs bg-muted px-2 py-1 rounded-md">
                <DollarSign className="h-3 w-3 mr-1" />
                <span>{totalCost.toFixed(5)}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-xs"
              disabled={messages.length === 0}
            >
              Clear History
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground">
                <Bot className="h-8 w-8 mb-2" />
                <p>Ask me anything about your log files!</p>
                <p className="text-xs mt-2">
                  {isApiKeySet()
                    ? `Using ${aiProvider === "openai" ? `OpenAI (${selectedOpenaiModel})` : `OpenRouter (${selectedOpenRouterModel})`}. Type a message to start.`
                    : `Please set your ${aiProvider === "openai" ? "OpenAI" : "OpenRouter"} API key in settings first.`}
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    {message.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex justify-between items-start">
                          <div
                            className="markdown-content w-full break-words"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(message.content, message.id),
                            }}
                          />
                          <button
                            className={`ml-2 p-1 rounded ${copiedMessageId === message.id ? 'bg-green-500 text-white' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}
                            onClick={() => copyToClipboard(message.content, setCopiedMessageId, message.id)}
                          >
                            {copiedMessageId === message.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {message.tokens && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Tokens: {message.tokens.prompt} in / {message.tokens.completion} out • 
                            Cost: ${message.tokens.cost.toFixed(5)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 inline-flex items-center space-x-1">
                  <span className="animate-bounce delay-0 duration-1000">.</span>
                  <span className="animate-bounce delay-150 duration-1000">.</span>
                  <span className="animate-bounce delay-300 duration-1000">.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          {!isApiKeySet() ? (
            <Button
              className="w-full"
              onClick={() => setSettingsOpen(true)}
              variant="outline"
            >
              Set API Key to Start
            </Button>
          ) : (
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[80px] resize-none"
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (isLoading) {
                     e.preventDefault();
                     return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                className="self-end"
                size="icon"
                disabled={isLoading || !input.trim()}
                onClick={sendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Provider Settings</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ai-provider">AI Provider</Label>
              <Select
                value={tempProvider}
                onValueChange={(value) => setTempProvider(value as AIProvider)}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue placeholder="Select AI Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tempProvider === "openai" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                  <Input
                    id="openai-api-key"
                    type="password"
                    value={tempOpenaiKey}
                    onChange={(e) => setTempOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <Select
                    value={tempOpenaiModel}
                    onValueChange={(value) => setTempOpenaiModel(value)}
                  >
                    <SelectTrigger id="openai-model">
                      <SelectValue placeholder="Select OpenAI Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {openaiModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {tempProvider === "openrouter" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="openrouter-api-key">OpenRouter API Key</Label>
                  <Input
                    id="openrouter-api-key"
                    type="password"
                    value={tempOpenRouterKey}
                    onChange={(e) => setTempOpenRouterKey(e.target.value)}
                    placeholder="sk-or-..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="openrouter-model">OpenRouter Model</Label>
                  <Select
                    value={tempOpenRouterModel}
                    onValueChange={(value) => setTempOpenRouterModel(value)}
                  >
                    <SelectTrigger id="openrouter-model">
                      <SelectValue placeholder="Select OpenRouter Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {openRouterModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPanel;
