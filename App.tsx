import React, { useState, useMemo, useDeferredValue, useRef } from 'react';
import { toBlob, toPng } from 'html-to-image';
import { DiffChunk } from './types';
import { calculateDiffs, getCleanText, getRedlineHtml } from './utils/diffUtils';
import { improveText, explainChanges } from './services/geminiService';
import { Button } from './components/Button';
import { RotateCcw, Wand2, FileText, FileDiff, ArrowRightLeft, Mail, X, Copy } from 'lucide-react';

export default function App() {
  // Inputs
  const [originalText, setOriginalText] = useState('');
  const [revisedText, setRevisedText] = useState('');
  const [isRevisedDirty, setIsRevisedDirty] = useState(false);
  
  // State for AI processing
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  
  // State for Email Preview Modal
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewPlain, setEmailPreviewPlain] = useState<string | null>(null);

  // Refs
  const redlineRef = useRef<HTMLDivElement>(null);

  // Deferred values for performance during real-time diffing
  const deferredOriginal = useDeferredValue(originalText);
  const deferredRevised = useDeferredValue(revisedText);

  // Real-time Diff Calculation
  const chunks = useMemo(() => {
    if (!deferredOriginal && !deferredRevised) return [];
    return calculateDiffs(deferredOriginal, deferredRevised);
  }, [deferredOriginal, deferredRevised]);

  // --- Handlers ---

  const handleOriginalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setOriginalText(newVal);
    
    // Auto-populate revised text if it hasn't been manually edited yet
    if (!isRevisedDirty && !revisedText) {
        setRevisedText(newVal);
    }
  };

  const handleRevisedChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRevisedText(e.target.value);
    setIsRevisedDirty(true);
  };

  const handleGenerateRevision = async () => {
    if (!originalText) return;
    setIsAiLoading(true);
    try {
      const improved = await improveText(originalText);
      setRevisedText(improved);
      setIsRevisedDirty(true);
    } catch (err) {
      alert("Failed to generate revision. Please check your API key or connection.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleReset = () => {
    setOriginalText('');
    setRevisedText('');
    setIsRevisedDirty(false);
  };

  const handleCopyClean = () => {
    const text = getCleanText(chunks);
    navigator.clipboard.writeText(text);
    alert('Copied clean text to clipboard!');
  };

  const handleCopyRedline = async () => {
    const htmlContent = getRedlineHtml(chunks);
    const plainText = getCleanText(chunks); // Fallback plain text is the clean version

    // Wrap in a div with default font for Outlook
    const fullHtml = `
      <div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000;">
        ${htmlContent}
      </div>
    `;

    try {
      const blobHtml = new Blob([fullHtml], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      
      if (typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': blobHtml,
              'text/plain': blobText,
            }),
          ]);
          alert('Copied redline text for Outlook/Word!');
      } else {
           navigator.clipboard.writeText(plainText);
           alert('Copied clean text (Rich text copy not supported in this browser).');
      }
    } catch (err) {
      console.error('Failed to copy html: ', err);
      navigator.clipboard.writeText(plainText);
      alert('Copied clean text (Failed to apply formatting).');
    }
  };

  const handleCopyImage = async () => {
    if (!redlineRef.current) return;
    
    setIsImageLoading(true);
    try {
      const node = redlineRef.current;
      
      // Create a hidden clone to calculate the height when width is 3x
      const targetWidth = node.offsetWidth * 3;
      const clone = node.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${targetWidth}px`;
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.display = 'block';
      document.body.appendChild(clone);
      
      const height = clone.scrollHeight;
      document.body.removeChild(clone);

      const blob = await toBlob(node, {
        backgroundColor: '#ffffff',
        width: targetWidth + 48, // Add space for padding
        height: height + 48,
        style: {
          borderRadius: '0',
          boxShadow: 'none',
          border: 'none',
          padding: '24px',
          margin: '0',
          width: `${targetWidth}px`,
          height: `${height}px`,
        }
      });

      if (blob && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        alert('Redline image copied to clipboard!');
      } else {
        alert('Clipboard image copy not supported in this browser.');
      }
    } catch (err) {
      console.error('Failed to copy image: ', err);
      alert('Failed to generate image. Try a smaller text selection.');
    } finally {
      setIsImageLoading(false);
    }
  };

  const handleGenerateEmailDraft = async () => {
    if (!redlineRef.current || !originalText || !revisedText) return;

    setIsEmailLoading(true);
    try {
      // 1. Generate explanation
      const explanation = await explainChanges(originalText, revisedText);

      // 2. Generate image as data URL
      const node = redlineRef.current;
      
      // Create a hidden clone to calculate the height when width is 3x
      const targetWidth = node.offsetWidth * 3;
      const clone = node.cloneNode(true) as HTMLDivElement;
      clone.style.width = `${targetWidth}px`;
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.display = 'block';
      document.body.appendChild(clone);
      
      const height = clone.scrollHeight;
      document.body.removeChild(clone);

      const dataUrl = await toPng(node, {
        backgroundColor: '#ffffff',
        width: targetWidth + 48,
        height: height + 48,
        style: {
          borderRadius: '0',
          boxShadow: 'none',
          border: 'none',
          padding: '24px',
          margin: '0',
          width: `${targetWidth}px`,
          height: `${height}px`,
        }
      });

      // 3. Prepare texts
      const cleanText = getCleanText(chunks);
      
      const htmlBody = `
        <div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
          <p>I have reviewed the text you provided and here is a red line version showing the changes I made:</p>
          <div style="margin: 20px 0; border: 1px solid #e2e8f0; display: inline-block;">
            <img src="${dataUrl}" alt="Redline Comparison" style="max-width: 100%; display: block;" />
          </div>
          <p><strong>Explanation of changes:</strong></p>
          <p>${explanation}</p>
          <br />
          <p><strong>Here is a clean version of the text:</strong></p>
          <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #cbd5e1; font-family: inherit;">
            ${cleanText.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;

      const plainText = `I have reviewed the text you provided and here is a red line version showing the changes I made.\n\nExplanation of changes:\n${explanation}\n\nHere is a clean version of the text:\n\n${cleanText}`;

      // Show preview modal instead of copying immediately
      setEmailPreviewHtml(htmlBody);
      setEmailPreviewPlain(plainText);
      
    } catch (err) {
      console.error('Failed to generate email draft:', err);
      alert('Failed to generate email draft.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleCopyEmailDraft = async () => {
    if (!emailPreviewHtml || !emailPreviewPlain) return;
    
    try {
      if (typeof ClipboardItem !== "undefined") {
        const blobHtml = new Blob([emailPreviewHtml], { type: 'text/html' });
        const blobText = new Blob([emailPreviewPlain], { type: 'text/plain' });
        
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          }),
        ]);
        alert('Email draft copied to clipboard!');
      } else {
        navigator.clipboard.writeText(emailPreviewPlain);
        alert('Copied plain text email draft (Rich text not supported).');
      }
      setEmailPreviewHtml(null);
      setEmailPreviewPlain(null);
    } catch (err) {
      console.error('Failed to copy email draft:', err);
      alert('Failed to copy email draft.');
    }
  };

  // --- Render Helpers ---

  const renderChunk = (chunk: DiffChunk) => {
    const isAdded = chunk.type === 'added';
    const isRemoved = chunk.type === 'removed';

    // Unchanged text
    if (chunk.type === 'unchanged') {
      return <span key={chunk.id} className="text-slate-800">{chunk.value}</span>;
    }

    let className = "inline whitespace-pre-wrap px-0.5 rounded ";

    if (isAdded) {
        // Green underline for additions
        className += " bg-emerald-100 text-emerald-800 decoration-emerald-500 underline decoration-2 underline-offset-2 font-medium";
    } else if (isRemoved) {
        // Red strikethrough for deletions
        className += " bg-red-100 text-red-800 line-through decoration-red-500 decoration-2 font-medium";
    }

    return (
      <span 
        key={chunk.id} 
        id={`chunk-${chunk.id}`}
        className={className}
      >
        {chunk.value}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="text-indigo-600" />
              Redline AI Reviewer
            </h1>
            <p className="text-xs text-slate-500 mt-1">Real-time comparison and editing</p>
          </div>
          <Button variant="secondary" onClick={handleReset} icon={<RotateCcw size={16} />} size="sm">
            Reset All
          </Button>
        </div>
      </header>

      {/* Main Content - 3 Pane Grid */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="max-w-[1600px] mx-auto w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          
          {/* Pane 1: Original Text */}
          <div className="flex flex-col gap-2 h-full min-h-[400px]">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText size={16} /> Original Text
              </label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-6"
                onClick={() => setOriginalText('')}
                disabled={!originalText}
              >
                Clear
              </Button>
            </div>
            <textarea
              className="flex-1 w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed shadow-sm"
              placeholder="Paste original text here..."
              value={originalText}
              onChange={handleOriginalChange}
            />
          </div>

          {/* Pane 2: Revised Text */}
          <div className="flex flex-col gap-2 h-full min-h-[400px]">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileDiff size={16} /> Revised Text
              </label>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="text-indigo-600 hover:bg-indigo-50 text-xs px-2 py-0.5 h-6"
                  onClick={handleGenerateRevision}
                  isLoading={isAiLoading}
                  disabled={!originalText || isAiLoading}
                  icon={<Wand2 size={12} />}
                >
                  AI Polish
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-6"
                  onClick={() => {
                    setRevisedText('');
                    setIsRevisedDirty(true);
                  }}
                  disabled={!revisedText}
                >
                  Clear
                </Button>
              </div>
            </div>
            <textarea
              className="flex-1 w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none font-mono text-sm leading-relaxed shadow-sm"
              placeholder="Edit your text here to see changes..."
              value={revisedText}
              onChange={handleRevisedChange}
            />
          </div>

          {/* Pane 3: Redline View */}
          <div className="flex flex-col gap-2 h-full min-h-[400px]">
             <div className="flex justify-between items-center px-1">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileDiff size={16} /> Redline View
                </label>
                <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-6 px-2" 
                      onClick={handleCopyClean}
                      title="Copy the final revised text without any redline markup"
                    >
                        Copy Clean
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-6 px-2 text-indigo-700" 
                      onClick={handleCopyRedline}
                      title="Copy the text with redline formatting (strikethrough and underline) to paste into Word or Outlook"
                    >
                        Copy Redline
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-6 px-2 text-emerald-700" 
                      onClick={handleCopyImage}
                      isLoading={isImageLoading}
                      title="Copy a wide image of the redline comparison to your clipboard"
                    >
                        Copy Image
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-6 px-2 text-blue-700" 
                      onClick={handleGenerateEmailDraft}
                      isLoading={isEmailLoading}
                      icon={<Mail size={14} />}
                      title="Generate an email draft with an AI explanation, the redline image, and the clean text"
                    >
                        Draft Email
                    </Button>
                </div>
            </div>
            <div 
              className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-y-auto p-6 leading-relaxed font-serif text-lg text-slate-800 whitespace-pre-wrap"
            >
              <div ref={redlineRef} className="bg-white whitespace-pre-wrap">
                {chunks.length > 0 ? (
                  chunks.map(renderChunk)
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm italic">
                    <ArrowRightLeft size={32} className="mb-2 opacity-20" />
                    <p>Changes will appear here in real-time</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Email Preview Modal */}
      {emailPreviewHtml && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Mail size={20} className="text-indigo-600" />
                Email Draft Preview
              </h2>
              <button 
                onClick={() => setEmailPreviewHtml(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div 
                className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm"
                dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
              />
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <Button 
                variant="secondary" 
                onClick={() => setEmailPreviewHtml(null)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCopyEmailDraft}
                icon={<Copy size={16} />}
              >
                Copy to Clipboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
