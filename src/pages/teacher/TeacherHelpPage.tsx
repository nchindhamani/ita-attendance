import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useRequireActiveProfile } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { TEACHER_HELP_FAQ } from '@/features/teacher/teacherHelpFaq'

export default function TeacherHelpPage() {
  useRequireActiveProfile()
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-[2.5rem] font-heading font-bold text-[#0f172a] leading-tight">
          Help
        </h2>
      </div>

      <div className="space-y-3 max-w-3xl">
        {TEACHER_HELP_FAQ.map((item) => {
          const isOpen = openId === item.id
          return (
            <div
              key={item.id}
              className={cn(
                'card-hover rounded-[16px] border bg-white overflow-hidden cursor-pointer',
                isOpen ? 'border-[#6366f1]' : 'border-[#e5e7eb]'
              )}
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={isOpen}
                className={cn(
                  'w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors',
                  isOpen ? 'bg-[rgba(99,102,241,0.06)]' : 'hover:bg-[#f8fafc]'
                )}
              >
                <span className="text-base font-semibold text-[#0f172a] leading-snug">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    'w-5 h-5 shrink-0 text-[#6366f1] transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#e0e7ff]">
                  <ol className="list-decimal list-outside ml-5 space-y-2 text-sm text-[#475569] leading-relaxed">
                    {item.answer.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
