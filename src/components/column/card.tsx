import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"
import { useWindowSize } from "react-use"
import { forwardRef, useImperativeHandle } from "react"
import { OverlayScrollbar } from "../common/overlay-scrollbar"
import { safeParseString } from "~/utils"
import { cache } from "~/utils/cache"

export interface ItemsProps extends React.HTMLAttributes<HTMLDivElement> {
  id: SourceID
  /**
   * 是否显示透明度，拖动时原卡片的样式
   */
  isDragged?: boolean
  handleListeners?: SyntheticListenerMap
}

interface NewsCardProps {
  id: SourceID
  handleListeners?: SyntheticListenerMap
}

export const CardWrapper = forwardRef<HTMLDivElement, ItemsProps>(({ id, isDragged, handleListeners, style, ...props }, dndRef) => {
  const ref = useRef<HTMLDivElement>(null)

  useImperativeHandle(dndRef, () => ref.current!)

  return (
    <div
      ref={ref}
      className={$(
        "flex flex-col h-500px rounded-2xl p-4 cursor-default",
        "backdrop-blur-5 transition-opacity-300",
        isDragged && "op-50",
        `bg-${sources[id].color}-500 dark:bg-${sources[id].color} bg-op-40!`,
      )}
      style={{
        transformOrigin: "50% 50%",
        ...style,
      }}
      {...props}
    >
      <NewsCard id={id} handleListeners={handleListeners} />
    </div>
  )
})

function NewsCard({ id, handleListeners }: NewsCardProps) {
  const { refresh, getRefreshId } = useRefetch()
  const { data, isFetching, isPlaceholderData, isError } = useQuery({
    queryKey: [id, getRefreshId(id)],
    queryFn: async ({ queryKey }) => {
      const [_id, _refetchTime] = queryKey as [SourceID, number]
      let url = `/s?id=${_id}`
      const headers: Record<string, any> = {}
      if (Date.now() - _refetchTime < 1000) {
        url = `/s?id=${_id}&latest`
        const jwt = safeParseString(localStorage.getItem("jwt"))
        if (jwt) headers.Authorization = `Bearer ${jwt}`
      } else if (cache.has(_id)) {
        return cache.get(_id)
      }

      const response: SourceResponse = await myFetch(url, {
        headers,
      })

      try {
        if (response.items && sources[_id].type === "hottest" && cache.has(_id)) {
          response.items.forEach((item, i) => {
            const o = cache.get(_id)!.items.findIndex(k => k.id === item.id)
            item.extra = {
              ...item?.extra,
              diff: o === -1 ? undefined : o - i,
            }
          })
        }
      } catch (e) {
        console.log(e)
      }

      cache.set(_id, response)
      return response
    },
    placeholderData: prev => prev,
    staleTime: 1000 * 60 * 1,
    retry: false,
  })

  const isFreshFetching = useMemo(() => isFetching && !isPlaceholderData, [isFetching, isPlaceholderData])

  const { isFocused, toggleFocus } = useFocusWith(id)

  return (
    <>
      <div className={$("flex justify-between mx-2 mt-0 mb-2 items-center")}>
        <div className="flex gap-2 items-center">
          <a
            className={$("w-8 h-8 rounded-full bg-cover hover:animate-spin")}
            target="_blank"
            href={sources[id].home}
            title={sources[id].desc}
            style={{
              backgroundImage: `url(/icons/${id.split("-")[0]}.png)`,
            }}
          />
          <span className="flex flex-col">
            <span className="flex items-center gap-2">
              <span
                className="text-xl font-bold"
                title={sources[id].desc}
              >
                {sources[id].name}
              </span>
              {sources[id]?.title && <span className={$("text-sm", `color-${sources[id].color} bg-base op-80 bg-op-50! px-1 rounded`)}>{sources[id].title}</span>}
            </span>
            <span className="text-xs op-70"><UpdatedTime isError={isError} updatedTime={data?.updatedTime} /></span>
          </span>
        </div>
        <div className={$("flex gap-2 text-lg", `color-${sources[id].color}`)}>
          <button
            type="button"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refresh(id)}
          />
          <button
            type="button"
            className={$("btn", isFocused ? "i-ph:star-fill" : "i-ph:star-duotone")}
            onClick={toggleFocus}
          />
          {handleListeners && (
            <button
              {...handleListeners}
              type="button"
              className={$("btn", "i-ph:dots-six-vertical-duotone", "cursor-grab")}
            />
          )}
        </div>
      </div>

      <OverlayScrollbar
        className={$([
          "h-full p-2 overflow-y-auto rounded-2xl bg-base bg-op-70!",
          isFreshFetching && `animate-pulse`,
          `sprinkle-${sources[id].color}`,
        ])}
        options={{
          overflow: { x: "hidden" },
        }}
        defer={false}
      >
        <div className={$("transition-opacity-500", isFreshFetching && "op-20")}>
          {!!data?.items?.length && (sources[id].type === "hottest" ? <NewsListHot items={data.items} /> : <NewsListTimeLine items={data.items} />)}
        </div>
      </OverlayScrollbar>
    </>
  )
}

function UpdatedTime({ isError, updatedTime }: { updatedTime: any, isError: boolean }) {
  const relativeTime = useRelativeTime(updatedTime ?? "")
  if (relativeTime) return `${relativeTime}更新`
  if (isError) return "获取失败"
  return "加载中..."
}

function DiffNumber({ diff }: { diff: number }) {
  const [shown, setShown] = useState(true)
  useEffect(() => {
    setShown(true)
    const timer = setTimeout(() => {
      setShown(false)
    }, 5000)
    return () => clearTimeout(timer)
  }, [setShown, diff])

  return (
    <AnimatePresence>
      { shown && (
        <motion.span
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 0.5, y: -7 }}
          exit={{ opacity: 0, y: -15 }}
          className={$("absolute left-0 text-xs", diff < 0 ? "text-green" : "text-red")}
        >
          {diff > 0 ? `+${diff}` : diff}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
function ExtraInfo({ item }: { item: NewsItem }) {
  if (item?.extra?.info) {
    return <>{item.extra.info}</>
  }
  if (item?.extra?.icon) {
    const { url, scale } = typeof item.extra.icon === "string" ? { url: item.extra.icon, scale: undefined } : item.extra.icon
    return (
      <img
        src={url}
        style={{
          transform: `scale(${scale ?? 1})`,
        }}
        className="h-4 inline mt--1"
        onError={e => e.currentTarget.style.display = "none"}
      />
    )
  }
}

function NewsUpdatedTime({ date }: { date: string | number }) {
  const relativeTime = useRelativeTime(date)
  return <>{relativeTime}</>
}
function NewsListHot({ items }: { items: NewsItem[] }) {
  const { width } = useWindowSize()
  return (
    <>
      {items?.map((item, i) => (
        <a
          href={width < 768 ? item.mobileUrl || item.url : item.url}
          target="_blank"
          key={item.id}
          title={item.extra?.hover}
          className={$(
            "flex gap-2 items-center mb-2 items-stretch relative",
            "hover:bg-neutral-400/10 rounded-md pr-1 visited:(text-neutral-400)",
          )}
        >
          <span className={$("bg-neutral-400/10 min-w-6 flex justify-center items-center rounded-md text-sm")}>
            {i + 1}
          </span>
          {!!item.extra?.diff && <DiffNumber diff={item.extra.diff} />}
          <span className="self-start line-height-none">
            <span className="mr-2 text-base">
              {item.title}
            </span>
            <span className="text-xs text-neutral-400/80 truncate align-middle">
              <ExtraInfo item={item} />
            </span>
          </span>
        </a>
      ))}
    </>
  )
}

function NewsListTimeLine({ items }: { items: NewsItem[] }) {
  const { width } = useWindowSize()
  return (
    <ol className="border-s border-neutral-400/50 flex flex-col ml-1">
      {items?.map(item => (
        <li key={item.id} className="flex flex-col">
          <span className="flex items-center gap-1 text-neutral-400/50 ml--1px">
            <span className="">-</span>
            <span className="text-xs text-neutral-400/80">
              {(item.pubDate || item?.extra?.date) && <NewsUpdatedTime date={(item.pubDate || item?.extra?.date)!} />}
            </span>
            <span className="text-xs text-neutral-400/80">
              <ExtraInfo item={item} />
            </span>
          </span>
          <a
            className={$("ml-2 px-1 hover:bg-neutral-400/10 rounded-md visited:(text-neutral-400/80)")}
            href={width < 768 ? item.mobileUrl || item.url : item.url}
            title={item.extra?.hover}
            target="_blank"
          >
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  )
}