import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, Settings } from "lucide-react";
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
} from "@/components/ui/select"; // Added for model selection

import { marked } from "marked";

type AIProvider = "openai" | "openrouter";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRequest: () => void; // New prop to request opening
  initialPrompt?: string | null;
}

// List of some popular OpenRouter models (can be expanded)
// See https://openrouter.ai/docs#models for more
const openRouterModels = [
  "openai/gpt-3.5-turbo",
  "openai/gpt-4o",
  "openai/gpt-4-turbo",
  "google/gemini-pro-1.5",
  "google/gemini-flash-1.5",
  "google/gemini-2.5-pro-exp-03-25:free", // Added new model
  "anthropic/claude-3.5-sonnet",
  "anthropic/claude-3-opus",
  "anthropic/claude-3-haiku",
  "mistralai/mistral-large",
  "mistralai/mixtral-8x7b",
  "meta-llama/llama-3-70b-instruct",
  "meta-llama/llama-3-8b-instruct",
  "deepseek/deepseek-v3-base:free", // Added new model
  "qwen/qwen2.5-vl-32b-instruct:free", // Added new model
];

// List of common OpenAI models
const openaiModels = [
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  // Add more models if needed, e.g., "gpt-4", "gpt-4-32k"
];

// Custom markdown renderer using marked
const renderMarkdown = (content: string) => {
  try {
    // Configure marked renderer
    const renderer = new marked.Renderer();

    // Custom code block renderer with syntax highlighting
    renderer.code = function ({ text, lang, escaped }) {
      // Extract the actual code text
      const codeText = typeof text === "string" ? text : String(text || "");
      const language = lang || "";

      // If already escaped, use directly, otherwise escape
      const escapedCode = escaped
        ? codeText
        : codeText
            .replace(/&/g, "&") // Escape ampersand
            .replace(/</g, "<")  // Escape less than
            .replace(/>/g, ">")  // Escape greater than
            .replace(/"/g, "&quot;") // Escape double quote
            .replace(/'/g, "&#039;"); // Escape single quote

      return `<pre><code class="${language ? `language-${language}` : ""}">${escapedCode}</code></pre>`;
    };

    // Set options for marked
    marked.setOptions({
      renderer: renderer,
      gfm: true,
      breaks: true,
    });

    // Parse the markdown content
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
  onOpenRequest, // Destructure new prop
  initialPrompt,
}) => {
  // Function to dispatch event to parent to set chat panel open state (kept for potential other uses)
  const dispatchOpenEvent = (open: boolean) => {
    console.log("ChatPanel: setChatPanelOpen called with:", open); // Diagnostic log
    if (open && !isOpen) {
      // Create a custom event to notify parent component
      const event = new CustomEvent("setChatPanelOpen", { detail: { open } });
      document.dispatchEvent(event);
    }
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for API settings
  const [aiProvider, setAiProvider] = useState<AIProvider>("openai");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [selectedOpenaiModel, setSelectedOpenaiModel] = useState<string>(
    openaiModels[0],
  ); // Default OpenAI model
  const [selectedOpenRouterModel, setSelectedOpenRouterModel] = useState<string>(
    openRouterModels[0],
  ); // Default OpenRouter model

  // Temporary state for settings dialog
  const [tempProvider, setTempProvider] = useState<AIProvider>(aiProvider);
  const [tempOpenaiKey, setTempOpenaiKey] = useState(openaiApiKey);
  const [tempOpenRouterKey, setTempOpenRouterKey] = useState(openRouterApiKey);
  const [tempOpenaiModel, setTempOpenaiModel] =
    useState(selectedOpenaiModel);
  const [tempOpenRouterModel, setTempOpenRouterModel] = useState(
    selectedOpenRouterModel,
  );

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedProvider = (localStorage.getItem("ai_provider") ||
      "openai") as AIProvider;
    const savedOpenaiKey = localStorage.getItem("openai_api_key") || "";
    const savedOpenRouterKey =
      localStorage.getItem("openrouter_api_key") || "";
    const savedOpenaiModel = localStorage.getItem("openai_model");
    const savedOpenRouterModel = localStorage.getItem("openrouter_model");

    setAiProvider(savedProvider);
    setOpenaiApiKey(savedOpenaiKey);
    setOpenRouterApiKey(savedOpenRouterKey);

    // Set OpenAI model, defaulting if saved one is invalid
    if (savedOpenaiModel && openaiModels.includes(savedOpenaiModel)) {
      setSelectedOpenaiModel(savedOpenaiModel);
    } else {
      setSelectedOpenaiModel(openaiModels[0]); // Default
    }

    // Set OpenRouter model, defaulting if saved one is invalid
    if (
      savedOpenRouterModel &&
      openRouterModels.includes(savedOpenRouterModel)
    ) {
      setSelectedOpenRouterModel(savedOpenRouterModel);
    } else {
      setSelectedOpenRouterModel(openRouterModels[0]); // Default
    }

    // Update temporary states for the dialog
    setTempProvider(savedProvider);
    setTempOpenaiKey(savedOpenaiKey);
    setTempOpenRouterKey(savedOpenRouterKey);
    setTempOpenaiModel(
      savedOpenaiModel && openaiModels.includes(savedOpenaiModel)
        ? savedOpenaiModel
        : openaiModels[0],
    );
    setTempOpenRouterModel(
      savedOpenRouterModel && openRouterModels.includes(savedOpenRouterModel)
        ? savedOpenRouterModel
        : openRouterModels[0],
    );
  }, []); // Run only once on mount

  // Update temporary settings state when dialog opens
  useEffect(() => {
    if (settingsOpen) {
      setTempProvider(aiProvider);
      setTempOpenaiKey(openaiApiKey);
      setTempOpenRouterKey(openRouterApiKey);
      setTempOpenaiModel(selectedOpenaiModel);
      setTempOpenRouterModel(selectedOpenRouterModel);
    }
  }, [
    settingsOpen,
    aiProvider,
    openaiApiKey,
    openRouterApiKey,
    selectedOpenaiModel,
    selectedOpenRouterModel,
    onOpenRequest, // Add onOpenRequest to dependencies
  ]);

  // Get current API key based on provider
  const getCurrentApiKey = () => {
    return aiProvider === "openai" ? openaiApiKey : openRouterApiKey;
  };

  // Listen for custom event to open chat with a prompt
  useEffect(() => {
    const handleOpenChatWithPrompt = (
      event: CustomEvent<{ prompt: string; autoSubmit?: boolean }>,
    ) => {
      // Directly request the parent to open the panel
      onOpenRequest();
      setInput(event.detail.prompt);
      const currentKey = getCurrentApiKey();

      // Auto-submit the question if autoSubmit is true or after a short delay
      if (event.detail.autoSubmit && currentKey) {
        setTimeout(async () => {
          if (currentKey && event.detail.prompt) {
            const userMessage: Message = {
              role: "user",
              content: event.detail.prompt,
            };
            // Set loading and clear input immediately for auto-submit
            setIsLoading(true);
            setInput(""); // Clear the input field now
            setMessages((prev) => [...prev, userMessage]); // Add user message *after* clearing input visually

            const apiEndpoint =
              aiProvider === "openai"
                ? "https://api.openai.com/v1/chat/completions"
                : "https://openrouter.ai/api/v1/chat/completions";

            const headers: HeadersInit = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentKey}`,
            };

            if (aiProvider === "openrouter") {
              headers["HTTP-Referer"] = `${window.location.origin}`; // Recommended by OpenRouter
              headers["X-Title"] = "Log Trawler AI Assistant"; // Recommended by OpenRouter
            }

            const modelToUse =
              aiProvider === "openai"
                ? selectedOpenaiModel
                : selectedOpenRouterModel;

            const body = JSON.stringify({
              model: modelToUse,
              messages: [...messages, userMessage], // Send current history + new message
              temperature: 0.7,
            });

            try {
              const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: headers,
                body: body,
              });

              if (!response.ok) {
                const errorData = await response.text(); // Read error body
                throw new Error(
                  `API error: ${response.status} - ${errorData}`,
                );
              }

              // Read response as text first for better error handling
              const rawText = await response.text();
              let data;
              try {
                data = JSON.parse(rawText);
              } catch (parseError) {
                 console.error("Failed to parse API response as JSON:", rawText);
                 throw new Error(`API Error (${aiProvider}): Failed to parse response. Raw response: ${rawText}`);
              }

              // Check structure of parsed data for success
              if (
                data &&
                data.choices &&
                data.choices.length > 0 &&
                data.choices[0].message &&
                data.choices[0].message.content
              ) {
                const assistantMessage: Message = {
                  role: "assistant",
                  content: data.choices[0].message.content,
                };
                setMessages((prev) => [...prev, assistantMessage]);
              }
              // If the OK response doesn't have the expected success structure,
              // it likely contains an API-level error object. Throw an error
              // so the catch block can handle it consistently.
              else {
                 console.warn("API response OK, but no choices found. Throwing error with response data:", data);
                 // Construct an error message prioritizing the API's error field
                 let errorPayload = `Unexpected response structure: ${JSON.stringify(data)}`;
                 if (data.error) { // Check if data.error exists
                    // Stringify the whole error object for context in the catch block
                    errorPayload = JSON.stringify(data.error);
                 }
                 // Throw an error that mimics the format used for non-OK responses
                 // Use the code from the error payload if available, otherwise a placeholder
                 const statusCode = data.error?.code || 'OK_but_ErrorPayload';
                 throw new Error(`API error: ${statusCode} - ${errorPayload}`);
              }
            } catch (error) {
              // This catch block handles network errors, non-OK responses, JSON parsing failures,
              // AND the explicitly thrown error for OK responses with error payloads.
              console.error(`Error calling ${aiProvider} API:`, error);
              // Provide more specific error feedback
              let errorMessage = `Sorry, there was an error processing your request with ${aiProvider}. Please check your API key/settings and try again.`;
              if (error instanceof Error) {
                // Check if the error message contains the JSON response from the API (added in the 'throw new Error' for !response.ok)
                const apiErrorMatch = error.message.match(
                  /API error:.*? - (\{.*\})/s, // Made status code match non-greedy
                );
                if (apiErrorMatch && apiErrorMatch[1]) {
                  const rawJsonString = apiErrorMatch[1]; // Store the raw JSON string
                  const statusMatch = error.message.match(/API error: ([\w_]+)/); // Match status code or placeholder
                  const statusCode = statusMatch ? statusMatch[1] : 'Unknown Status';
                  try {
                    const apiErrorJson = JSON.parse(rawJsonString);
                    // Use the specific message if available (check both root and nested error)
                    if (apiErrorJson.message) { // Check for top-level message first
                       errorMessage = `API Error (${aiProvider}): ${apiErrorJson.message}`;
                    } else if (apiErrorJson.error?.message) { // Check for nested error message
                      errorMessage = `API Error (${aiProvider}): ${apiErrorJson.error.message}`;
                    } else {
                      // Fallback to raw JSON string if specific message field isn't present
                      errorMessage = `API Error (${aiProvider}): ${statusCode}. Raw response: ${rawJsonString}`;
                    }
                  } catch (parseError) {
                    // Fallback to raw JSON string if parsing failed
                    errorMessage = `API Error (${aiProvider}): ${statusCode}. Raw response: ${rawJsonString}`;
                  }
                } else {
                  // Use the generic error message if it's not a specific API error format
                  errorMessage += ` Error: ${error.message}`;
                }
              } else {
                errorMessage += ` Error: ${String(error)}`;
              }

              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: errorMessage,
                },
              ]);
            } finally {
              // This block executes whether the try succeeds or fails (catches an error)
              setIsLoading(false);
            }
          } else {
             // Also ensure loading is false if the initial check fails
             setIsLoading(false);
          }
        }, 300);
      }
    };

    // Add event listener
    document.addEventListener(
      "openChatWithPrompt",
      handleOpenChatWithPrompt as EventListener,
    );

    // Clean up
    return () => {
      document.removeEventListener(
        "openChatWithPrompt",
        handleOpenChatWithPrompt as EventListener,
      );
    };
    // Dependencies: Only include variables the effect setup itself depends on.
    // The fetch call inside the handler will use the latest state when executed.
  }, [
    aiProvider,
    openaiApiKey,
    openRouterApiKey,
    selectedOpenaiModel,
    selectedOpenRouterModel,
    onOpenRequest, // Added dependency back
  ]);


  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus the input field when the panel opens and API key is set
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const currentKey = getCurrentApiKey();
    if (isOpen && textareaRef.current && currentKey) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 300); // Small delay
    }
  }, [isOpen, aiProvider, openaiApiKey, openRouterApiKey]); // Depend on keys and provider

  // Effect to handle the initial prompt
  useEffect(() => {
    if (isOpen && initialPrompt && textareaRef.current) {
      setInput(initialPrompt);
      // Optionally auto-submit here if desired, but requires careful handling
      // For now, just pre-fill the input
      textareaRef.current.focus(); // Focus after setting value
    }
    // We only want this effect to run when initialPrompt changes or isOpen becomes true
  }, [isOpen, initialPrompt]);

  const saveSettings = () => {
    // Save the temporary settings to actual state and localStorage
    setAiProvider(tempProvider);
    setOpenaiApiKey(tempOpenaiKey);
    setOpenRouterApiKey(tempOpenRouterKey);
    setSelectedOpenaiModel(tempOpenaiModel); // Save selected OpenAI model
    setSelectedOpenRouterModel(tempOpenRouterModel); // Save selected OpenRouter model

    localStorage.setItem("ai_provider", tempProvider);
    localStorage.setItem("openai_api_key", tempOpenaiKey);
    localStorage.setItem("openrouter_api_key", tempOpenRouterKey);
    localStorage.setItem("openai_model", tempOpenaiModel); // Persist OpenAI model
    localStorage.setItem("openrouter_model", tempOpenRouterModel); // Persist OpenRouter model

    setSettingsOpen(false);
  };

  const sendMessage = async () => {
    const currentKey = getCurrentApiKey();
    if (!input.trim() || !currentKey) return;

    const userMessage: Message = { role: "user", content: input };
    // Use functional update to ensure we have the latest messages state
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    const currentInput = input; // Capture input before clearing
    setInput(""); // Clear input immediately
    setIsLoading(true);

    // Use the latest messages state directly in the API call
    const messagesToSend = [...messages, userMessage];

    const apiEndpoint =
      aiProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentKey}`,
    };

    if (aiProvider === "openrouter") {
      headers["HTTP-Referer"] = `${window.location.origin}`; // Recommended by OpenRouter
              headers["X-Title"] = "Log Trawler AI Assistant"; // Recommended by OpenRouter
            }

            const modelToUse =
              aiProvider === "openai"
                ? selectedOpenaiModel
                : selectedOpenRouterModel;

            const body = JSON.stringify({
              model: modelToUse,
              messages: messagesToSend, // Send the captured messages state
              temperature: 0.7,
            });

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: headers,
        body: body,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} - ${errorData}`);
      }

      // Read response as text first for better error handling
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
         console.error("Failed to parse API response as JSON:", rawText);
         throw new Error(`API Error (${aiProvider}): Failed to parse response. Raw response: ${rawText}`);
      }

      // Check structure of parsed data for success
      if (
        data &&
        data.choices &&
        data.choices.length > 0 &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.choices[0].message.content,
        };
        // Use functional update for setting messages
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }
      // If the OK response doesn't have the expected success structure,
      // it likely contains an API-level error object. Throw an error
      // so the catch block can handle it consistently.
      else {
         console.warn("API response OK, but no choices found. Throwing error with response data:", data);
         // Construct an error message prioritizing the API's error field
         let errorPayload = `Unexpected response structure: ${JSON.stringify(data)}`;
         if (data.error) { // Check if data.error exists
            // Stringify the whole error object for context in the catch block
            errorPayload = JSON.stringify(data.error);
         }
         // Throw an error that mimics the format used for non-OK responses
         // Use the code from the error payload if available, otherwise a placeholder
         const statusCode = data.error?.code || 'OK_but_ErrorPayload';
         throw new Error(`API error: ${statusCode} - ${errorPayload}`);
      }
    } catch (error) {
      // This catch block handles network errors, non-OK responses, JSON parsing failures,
      // AND the explicitly thrown error for OK responses with error payloads.
      console.error(`Error calling ${aiProvider} API:`, error);
       // Provide more specific error feedback
      let errorMessage = `Sorry, there was an error processing your request with ${aiProvider}. Please check your API key/settings and try again.`;
      if (error instanceof Error) {
        // Check if the error message contains the JSON response from the API
        const apiErrorMatch = error.message.match(
           /API error:.*? - (\{.*\})/s, // Made status code match non-greedy
        );
        if (apiErrorMatch && apiErrorMatch[1]) {
          const rawJsonString = apiErrorMatch[1]; // Store the raw JSON string
          const statusMatch = error.message.match(/API error: ([\w_]+)/); // Match status code or placeholder
          const statusCode = statusMatch ? statusMatch[1] : 'Unknown Status';
          try {
            const apiErrorJson = JSON.parse(rawJsonString);
            // Use the specific message if available (check both root and nested error)
            if (apiErrorJson.message) { // Check for top-level message first
               errorMessage = `API Error (${aiProvider}): ${apiErrorJson.message}`;
            } else if (apiErrorJson.error?.message) { // Check for nested error message
              errorMessage = `API Error (${aiProvider}): ${apiErrorJson.error.message}`;
            } else {
              // Fallback to raw JSON string if specific message field isn't present
              errorMessage = `API Error (${aiProvider}): ${statusCode}. Raw response: ${rawJsonString}`;
            }
          } catch (parseError) {
            // Fallback to raw JSON string if parsing failed
            errorMessage = `API Error (${aiProvider}): ${statusCode}. Raw response: ${rawJsonString}`;
          }
        } else {
          errorMessage += ` Error: ${error.message}`;
        }
      } else {
        errorMessage += ` Error: ${String(error)}`;
      }

      // Use functional update for setting messages
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
            overflow: auto;
            margin: 8px 0;
            border-left: 3px solid #4f46e5;
          }
          .markdown-content pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            color: #e5e7eb;
          }
          .markdown-content p {
            margin-bottom: 0.5rem;
          }
          .markdown-content h1 {
            font-size: 1.25rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          .markdown-content h2 {
            font-size: 1.125rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
          }
          .markdown-content h3 {
            font-size: 1rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
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
          .syntax-highlight {
            background-color: #2d3748;
            border-radius: 4px;
            padding: 8px;
            overflow: auto;
            font-family: monospace;
            border-left: 3px solid #4f46e5;
          }
        `}</style>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-medium">AI Assistant</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMessages([])}
              className="text-xs"
              disabled={messages.length === 0}
            >
              Clear History
            </Button>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AI Provider Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  {/* Provider Selection */}
                  <div className="grid gap-2">
                    <Label htmlFor="ai-provider">AI Provider</Label>
                    <Select
                      value={tempProvider}
                      onValueChange={(value) =>
                        setTempProvider(value as AIProvider)
                      }
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

                  {/* OpenAI Settings */}
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
                        <p className="text-xs text-muted-foreground">
                          Your OpenAI API key is stored locally.
                        </p>
                      </div>
                      {/* OpenAI Model Selection */}
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
                        <p className="text-xs text-muted-foreground">
                          Select the OpenAI model to use.
                        </p>
                      </div>
                    </>
                  )}

                  {/* OpenRouter Settings */}
                  {tempProvider === "openrouter" && (
                    <>
                      <div className="grid gap-2">
                        <Label htmlFor="openrouter-api-key">
                          OpenRouter API Key
                        </Label>
                        <Input
                          id="openrouter-api-key"
                          type="password"
                          value={tempOpenRouterKey}
                          onChange={(e) => setTempOpenRouterKey(e.target.value)}
                          placeholder="sk-or-..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Your OpenRouter API key is stored locally. Get yours
                          at{" "}
                          <a
                            href="https://openrouter.ai/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            openrouter.ai/keys
                          </a>
                          .
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="openrouter-model">OpenRouter Model</Label>
                        <Select
                          value={tempOpenRouterModel}
                          onValueChange={(value) =>
                            setTempOpenRouterModel(value)
                          }
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
                        <p className="text-xs text-muted-foreground">
                          Select the OpenRouter model to use. See{" "}
                          <a
                            href="https://openrouter.ai/docs#models"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            available models
                          </a>
                          .
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={saveSettings}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div
                        className="markdown-content"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(message.content),
                        }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 inline-flex items-center space-x-1">
                  <span className="animate-bounce delay-0 duration-1000">.</span>
                  <span className="animate-bounce delay-150 duration-1000">.</span>
                  <span className="animate-bounce delay-300 duration-1000">.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} /> {/* Ensure this is always last */}
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
                disabled={isLoading} // Disable textarea while loading
                onKeyDown={(e) => {
                  // Prevent sending new message while loading if Enter is pressed
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
    </div>
  );
};

export default ChatPanel;
