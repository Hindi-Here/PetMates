import './event_page.scss'
import LockIcon from '@icons/lock.svg?react'
import { memo, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys } from '../../scripts/query/queryKeys'
import { eventApi, type EventFormField, type UpdateEventDto } from '../../services/event'
import { EventDescription } from './event_description'
import { EventForm } from './event_form'
import { EventMembers } from './event_members'
import { EventResults } from './event_results'
import { EventApplications } from './event_applications'
import { EventApplicationDetail } from './event_application_detail'
import { EventFooter } from './event_footer'
import { EventTabs, EVENT_TABS, PUBLIC_EVENT_TABS } from './event_tabs'
import { EventPublicView, toPublicData, type EventPublicData } from './event_public_view'
import { EventPreviewContext } from './event_preview_context'
import { STALE } from '@/components/scripts/query/queryClient'

const DescriptionPane = memo(EventDescription)
const FormPane = memo(EventForm)
const ResultsPane = memo(EventResults)

const applyDrafts = (
  base: EventPublicData,
  desc: UpdateEventDto | null,
  form: EventFormField[] | null,
  results: string | null
): EventPublicData => ({
  ...base,
  ...(desc ? {
    title: desc.title,
    shortDescription: desc.shortDescription,
    status: desc.status,
    isPrivate: desc.isPrivate,
    eventStartDate: desc.eventStartDate,
    eventEndDate: desc.eventEndDate,
    participantLimit: desc.participantLimit,
    stages: desc.stages,
    description: desc.description,
  } : {}),
  ...(form ? { applicationForm: form } : {}),
  ...(results !== null ? { results } : {}),
})

export const EventPage = () => {
  const { eventId } = useParams<{ eventId: string }>()
  return <EventPageInner key={eventId} />
}

// Компонент для отображения страницы мероприятия с различными вкладками (используется в EventPage)
const EventPageInner = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { profileId, eventId } = useParams<{ profileId: string; eventId: string }>()
  const { userId, isAuthenticated } = useAuth()

  const [isPreview, setIsPreview] = useState(false)
  const [descDraft, setDescDraft] = useState<UpdateEventDto | null>(null)
  const [formDraft, setFormDraft] = useState<EventFormField[] | null>(null)
  const [resultsDraft, setResultsDraft] = useState<string | null>(null)

  const { data: event, isLoading } = useQuery({
    queryKey: queryKeys.events.byId(eventId!),
    queryFn: () => eventApi.getEvent(eventId!),
    enabled: !!eventId,
    staleTime: STALE.none,
  })

  const isOwnerView = !!event && event.ownerId === userId

  const { data: drafts, isLoading: draftsLoading } = useQuery({
    queryKey: queryKeys.events.draft(eventId!),
    queryFn: () => eventApi.getDraft(eventId!),
    enabled: isOwnerView,
    staleTime: STALE.none,
  })

  const publicData = useMemo(
    () => (event ? applyDrafts(toPublicData(event), descDraft, formDraft, resultsDraft) : null),
    [event, descDraft, formDraft, resultsDraft]
  )

  const base = `/profile/${profileId}/activity/event/${eventId}`
  const tabPath = (id: string) => (id === 'info' ? base : `${base}/${id}`)
  const eventsListPath = `/profile/${profileId}/activity?section=events`
  const goBack = () => navigate(eventsListPath, { replace: true })

  const segments = pathname.startsWith(base)
    ? pathname.slice(base.length).split('/').filter(Boolean)
    : []
  const activeTab = segments[0] ?? 'info'
  const applicationId = segments[1]

  if (isLoading || isAuthenticated === null || draftsLoading) {
    return <div className='loading-container' />
  }

  if (!event || !publicData) {
    return (
      <div className='banned-gate'>
        <div className='info-container'>
          <LockIcon className='info-ico' />
          <p className='info-comment'>Мероприятие недоступно</p>
          <p className='info-subcomment'>Оно удалено или у вас нет доступа</p>
        </div>
      </div>
    )
  }

  if (!EVENT_TABS.some(t => t.id === activeTab)) {
    return <Navigate to={base} replace />
  }

  if (!isOwnerView) {
    if (!PUBLIC_EVENT_TABS.some(t => t.id === activeTab)) {
      return <Navigate to={base} replace />
    }
    return (
      <div className='project-page'>
        <EventPublicView data={publicData} activeTab={activeTab} basePath={base} onBack={goBack} />
      </div>
    )
  }

  const handlePreviewChange = (value: boolean) => {
    if (value && activeTab === 'applications') navigate(base)
    setIsPreview(value)
  }

  return (
    <EventPreviewContext.Provider value={{ isPreview, setPreview: handlePreviewChange }}>
      <div className='project-page event-page'>
        {isPreview ? (
          <EventPublicView
            data={publicData}
            activeTab={activeTab === 'applications' ? 'info' : activeTab}
            basePath={base}
            isPreview
            onBack={goBack}
            footer={<EventFooter showActions={false} />}
          />
        ) : (
          <EventTabs tabs={EVENT_TABS} active={activeTab} onSelect={id => navigate(tabPath(id))} />
        )}

        <div className='event-tab-pane' hidden={isPreview || activeTab !== 'info'}>
          <DescriptionPane
            event={event}
            profileId={profileId!}
            draft={drafts?.general ?? null}
            onDraftChange={setDescDraft}
          />
        </div>
        <div className='event-tab-pane' hidden={isPreview || activeTab !== 'form'}>
          <FormPane
            event={event}
            profileId={profileId!}
            draft={drafts?.form ?? null}
            onDraftChange={setFormDraft}
          />
        </div>
        <div className='event-tab-pane' hidden={isPreview || activeTab !== 'results'}>
          <ResultsPane
            event={event}
            profileId={profileId!}
            draft={drafts?.results ?? null}
            onDraftChange={setResultsDraft}
          />
        </div>

        {!isPreview && activeTab === 'members' && (
          <>
            <EventMembers eventId={event.eventId} participantLimit={event.participantLimit} />
            <EventFooter showActions={false} />
          </>
        )}

        {!isPreview && activeTab === 'applications' && (
          applicationId ? (
            <EventApplicationDetail
              key={applicationId}
              eventId={event.eventId}
              applicationId={applicationId}
              basePath={base}
            />
          ) : (
            <EventApplications eventId={event.eventId} basePath={base} />
          )
        )}
      </div>
    </EventPreviewContext.Provider>
  )
}