import { useRef, useEffect } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ChatInputFormProps {
  onSubmit: (prompt: string) => void;
  isSending: boolean;
}

// Re-define the schema using Zod
const messageSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(4000, "Message cannot exceed 4000 characters"),
});

type MessageFormData = z.infer<typeof messageSchema>;

export function ChatInputForm({ onSubmit, isSending }: ChatInputFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid }, // Use errors and isValid from formState
  } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      prompt: "",
    },
    mode: "onChange", // Validate on change to provide immediate feedback
  });

  const promptValue = watch("prompt"); // Watch the value for height adjustment
  const promptLength = promptValue?.length || 0;
  const maxLength =
    messageSchema.shape.prompt._def.checks.find((check) => check.kind === "max")
      ?.value || 4000;

  // useEffect for height adjustment - adapts to watch promptValue
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = "auto"; // Reset height
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 300)}px`; // Keep max height
    };

    adjustHeight(); // Adjust height initially

    // Adjust height on input driven by react-hook-form state change
    // No need for separate event listener here as `watch` triggers re-render
  }, [promptValue]); // Depend on the watched value

  // Form submission handler using react-hook-form's handleSubmit
  const processSubmit = (data: MessageFormData) => {
    onSubmit(data.prompt.trim()); // Pass validated & trimmed data
    reset(); // Reset form after successful submission
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && isValid && !isSending) {
      e.preventDefault();
      handleSubmit(processSubmit)(); // Trigger validation and submission
    }
  };

  return (
    // Use react-hook-form's handleSubmit for the form's onSubmit
    <form
      onSubmit={handleSubmit(processSubmit)}
      className="flex flex-col gap-2"
    >
      {/* Use data attribute driven by form error state */}
      <div
        className="flex gap-2 bg-background shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-lg p-2 border border-transparent"
        data-invalid={!!errors.prompt}
      >
        <div className="flex-1">
          <Textarea
            // Use register from react-hook-form
            {...register("prompt")}
            ref={(e) => {
              // Combine refs for react-hook-form and local usage
              register("prompt").ref(e);
              textareaRef.current = e;
            }}
            placeholder="Type your message... (Press Shift + Enter for new line)"
            className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none min-h-[44px] max-h-[300px] overflow-y-auto"
            disabled={isSending}
            rows={1}
            onKeyDown={handleKeyDown}
            aria-label="Message input"
            aria-invalid={!!errors.prompt}
          />
        </div>
        <Button
          type="submit"
          // Disable based on react-hook-form's isValid and isSending prop
          disabled={isSending || !isValid}
          variant={isValid ? "default" : "secondary"}
          className="self-end"
          aria-label="Send message"
        >
          {isSending ? "Sending..." : "Send"}
        </Button>
      </div>
      {/* Display error message ONLY if it's the max length error */}
      {errors.prompt && errors.prompt.message?.includes("exceed") && (
        <p className="text-xs text-red-500 text-right">
          {errors.prompt.message} ({promptLength}/{maxLength})
        </p>
      )}
    </form>
  );
}
