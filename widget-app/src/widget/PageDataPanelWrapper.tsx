import { PageDataPanel, type PageState } from './PageDataPanel'

interface PageDataPanelWrapperProps {
  pageState: PageState | null
  onRefresh: () => void
}

export function PageDataPanelWrapper({
  pageState,
  onRefresh,
}: PageDataPanelWrapperProps) {
  return (
    <div className="[&_h2]:m-0 [&_h2]:mb-1.5 [&_h3]:m-0 [&_h3]:mb-1.5 [&_h2]:text-[13px] [&_h3]:text-[13px] [&_h2]:text-gamedin-accent [&_h3]:text-gamedin-accent">
      <PageDataPanel pageState={pageState} onRefresh={onRefresh} />
    </div>
  )
}
