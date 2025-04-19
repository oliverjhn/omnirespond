import { useState, useEffect } from "react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { ChevronLeft, ChevronRight, Upload } from "lucide-react"
import { cn } from "~/lib/utils"

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    const checkWidth = () => {
      setIsOpen(window.innerWidth >= 1536)
    }

    // Set initial state
    checkWidth()

    // Update state on resize
    window.addEventListener('resize', checkWidth)
    return () => window.removeEventListener('resize', checkWidth)
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      setUploadError('Please upload a PDF file')
      return
    }

    try {
      setIsUploading(true)
      setUploadError(null)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:8000/upload/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      // Reset the input
      event.target.value = ''
    } catch (error) {
      setUploadError('Failed to upload file. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 2xl:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="fixed right-0 top-0 h-screen flex z-50"
        role="complementary"
        aria-label="Workspace Information"
      >
        <div
          className={cn(
            "relative flex h-full transition-transform duration-300 ease-in-out",
            isOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "h-8 w-8 absolute top-1/2 -translate-y-1/2 z-50 transition-all duration-300",
              isOpen ? "left-0 -translate-x-1/2" : "-left-8"
            )}
            aria-expanded={isOpen}
            aria-controls="sidebar-content"
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          <div
            id="sidebar-content"
            className="w-[400px] bg-background border-l p-6 shadow-xl flex flex-col"
          >
            <div className="flex-1 space-y-4">
              <h2 className="text-lg font-semibold">Workspace Info</h2>
              <p>Your workspace content will go here</p>
            </div>

            {/* Upload Section */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="flex-1"
                  aria-label="Upload PDF file"
                />
                {isUploading && <Upload className="animate-bounce h-4 w-4" />}
              </div>
              {uploadError && (
                <p className="text-sm text-red-500">{uploadError}</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
