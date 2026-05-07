interface IRiSInsightBannerProps {
  message: string
}

export function IRiSInsightBanner({ message }: IRiSInsightBannerProps) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-lg border border-[#AED6F1] bg-[#EBF5FB] px-3.5 py-2.5 text-[13px] text-iris-text-primary">
      <div className="flex items-center gap-3">
        <span className="text-base font-semibold text-iris-blue">AI</span>
        <span>
          <strong>IRiS Insight</strong> - {message}
        </span>
      </div>
      <span className="text-[12px] font-medium text-iris-blue">Review -&gt;</span>
    </div>
  )
}
