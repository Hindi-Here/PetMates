import InfoIcon from '@icons/info.svg?react'
import AcceptIcon from '@icons/accept.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import type { NotificationData } from '../services/notification'

export const getNotificationIcon = (referenceType: string, contextData: any) => {
  const eventType = contextData?.eventType

  if (referenceType === 'project') {
    if (
      [
        'removed', 'removed_self', 'project_deleted', 'owner_banned', 
        'owner_deleted', 'project_deleted_by_moderator', 'project_deleted_by_owner'
      ].includes(eventType)
    ) {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else if (['added', 'added_self'].includes(eventType)) {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  if (referenceType === 'response') {
    if (['response_accepted'].includes(eventType)) {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else if (
      [
        'response_rejected', 'response_cancelled', 'vacancy_deleted_by_moderator',
        'responses_revoked_project_deleted', 'responses_revoked_vacancy_deleted', 
        'responses_revoked_project_deleted_by_moderator', 'responses_revoked_vacancy_deleted_by_moderator', 
        'response_paused_owner_banned', 'response_resumed_owner_unbanned'
      ].includes(eventType)
    ) {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  if (referenceType === 'invite') {
    if (['invite_accepted'].includes(eventType)) {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else if (
      [
        'invite_rejected', 'invite_cancelled', 'invites_revoked_project_deleted',
        'invites_revoked_vacancy_deleted', 'invites_revoked_project_deleted_by_moderator',
        'invites_revoked_vacancy_deleted_by_moderator', 'invite_paused_owner_banned',
        'invite_resumed_owner_unbanned'
      ].includes(eventType)
    ) {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  if (referenceType === 'system') {
    if (['promoted_to_admin', 'promoted_to_moderator', 'unbanned'].includes(eventType)) {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    }
    if (['demoted_from_admin', 'demoted_from_moderator', 'banned'].includes(eventType)) {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    }
    return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
  }

  if (referenceType === 'event') {
    return ['event_deleted_by_owner', 'event_deleted_by_moderator', 'event_deleted_members_notified'].includes(eventType)
      ? { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
      : { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
  }

  if (referenceType === 'application') {
    if (eventType === 'application_accepted') return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    if (['application_rejected', 'application_revoked_event_deleted'].includes(eventType))
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
  }

  if (referenceType === 'comment') {
    return ['comment_deleted_by_moderator', 'comment_deleted_by_owner'].includes(eventType)
      ? { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
      : { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
  }

  return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
}

export const getNotificationText = (notification: NotificationData) => {
  const { referenceType, contextData } = notification
  const eventType = contextData?.eventType
  const nickname = contextData?.nickname
  const projectName = contextData?.projectName || 'Проект'
  const eventName = contextData?.eventName || projectName
  const vacancyName = contextData?.vacancyName || 'Заявка'
  const role = contextData?.role
  const status = contextData?.status
  const reason = contextData?.reason

  const comment = contextData?.comment
  const targetName = contextData?.targetName || 'объект'
  const note = comment ? <> Комментарий: {comment}</> : null

  const nicknameStyle = { fontWeight: 600, fontStyle: 'italic' }
  const projectStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const roleStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const statusStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  // Системные уведомления
  if (referenceType === 'system') {
    switch (eventType) {
      case 'promoted_to_admin':
        return <span>Вас назначили <strong style={roleStyle}>администратором</strong></span>
      case 'promoted_to_moderator':
        return <span>Вас назначили <strong style={roleStyle}>модератором</strong></span>
      case 'demoted_from_admin':
        return <span>С вас сняли роль <strong style={roleStyle}>администратора</strong></span>
      case 'demoted_from_moderator':
        return <span>С вас сняли роль <strong style={roleStyle}>модератора</strong></span>
      case 'unbanned':
        return <span>Вы были разблокированы</span>
      case 'banned':
        return <span>Ваш аккаунт был заблокирован. Причина: {reason || 'не указана'}</span>
      default:
        return <span>Системное уведомление</span>
    }
  }

  // Уведомления о проектах
  if (referenceType === 'project') {
    switch (eventType) {
      case 'added':
        return <span><strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> был добавлен в проект <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> в качестве <strong style={roleStyle}>{role}</strong></span>
      case 'added_self':
        return <span>Вы были добавлены в проект <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> в качестве <strong style={roleStyle}>{role}</strong></span>
      case 'removed':
        return <span><strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> был исключен из проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong></span>
      case 'removed_self':
        return <span>Вы были исключены из проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong></span>
      case 'role_changed':
        return <span>Роль <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> была изменена на <strong style={roleStyle}>{role}</strong></span>
      case 'role_changed_self':
        return <span>Ваша роль в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> была изменена на <strong style={roleStyle}>{role}</strong></span>
      case 'status_changed':
        return <span>Статус проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> был изменен на <strong style={statusStyle}>{status}</strong></span>
      case 'owner_banned':
        return <span>Вы были исключены из проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. Владелец проекта получил бан</span>
      case 'project_deleted':
        return <span>Вы были исключены из проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. Проект был удален</span>
      case 'owner_deleted':
        return <span>Вы были исключены из проекта <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. Владелец удалил свой аккаунт</span>
      case 'project_deleted_by_moderator':
        return <span>Ваш проект <strong style={projectStyle}>{projectName}</strong> был удалён модератором. Причина: {reason || 'не указана'}</span>
      case 'project_deleted_by_owner': 
        return <span>Ваш проект <strong style={projectStyle}>{projectName}</strong> был удалён</span>
      case 'member_left':
        return <span><strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> покинул(а) проект <strong style={projectStyle}>{projectName}</strong></span>
      default:
        return <span>Уведомление о проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong></span>
    }
  }

  // Уведомления о откликах
  if (referenceType === 'response') {
    switch (eventType) {
      case 'response_received':
        return <span>Вы получили отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong></span>
      case 'response_accepted':
        return <span>Отклик на участие в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> был принят</span>
      case 'response_rejected':
        return <span>Ваш отклик на участие в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> был отклонен</span>
      case 'response_cancelled':
        return <span>Полученный отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> был отозван</span>
      case 'responses_revoked_owner_deleted':
        return <span>Все отклики к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> были отозваны. Владелец проекта удалил свой аккаунт</span>
      case 'responses_revoked_project_deleted':
        return <span>Все отклики к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отозваны. Проект был удален</span>
      case 'responses_revoked_vacancy_deleted':
        return <span>Все отклики к заявке <strong style={roleStyle}>{vacancyName}</strong> были отозваны. Заявка была удалена</span>
      case 'responses_revoked_project_deleted_by_moderator':
        return <span>Все отклики к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отменены. Проект был удален модератором</span>
      case 'responses_revoked_vacancy_deleted_by_moderator':
        return <span>Все отклики к заявке <strong style={roleStyle}>{vacancyName}</strong> были отменены. Заявка была удалена модератором</span>
      case 'response_paused_owner_banned':
        return <span>Рассмотрение вашего отклика на роль <strong style={roleStyle}>{vacancyName}</strong> в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> приостановлено. Владелец проекта заблокирован</span>
      case 'response_resumed_owner_unbanned':
        return <span>Рассмотрение вашего отклика на роль <strong style={roleStyle}>{vacancyName}</strong> в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> возобновлено. Владелец проекта разблокирован</span>
      case 'responses_revoked_user_deleted':
        return <span>Все полученные отклики от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> были отозваны. Пользователь удалил свой аккаунт</span>
      case 'vacancy_deleted_by_moderator':
        return <span>Ваша заявка <strong style={roleStyle}>{vacancyName}</strong> была удалена модератором. Причина: {reason || 'не указана'}</span>
      default:
        return <span>Уведомление об отклике к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong></span>
    }
  }

  // Уведомления о приглашениях
  if (referenceType === 'invite') {
    switch (eventType) {
      case 'invite_received':
        return <span>Вы получили приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong></span>
      case 'invite_accepted':
        return <span>Приглашение на участие в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> было принято</span>
      case 'invite_rejected':
        return <span>Ваше приглашение на участие в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> было отклонено</span>
      case 'invite_cancelled':
        return <span>Полученное приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль <strong style={roleStyle}>{vacancyName}</strong> было отозвано</span>
      case 'invites_revoked_owner_deleted':
        return <span>Все приглашения к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> были отозваны. Владелец проекта удалил свой аккаунт</span>
      case 'invites_revoked_project_deleted':
        return <span>Все приглашения к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отозваны. Проект был удален</span>
      case 'invites_revoked_vacancy_deleted':
        return <span>Все приглашения к заявке <strong style={roleStyle}>{vacancyName}</strong> были отозваны. Заявка была удалена</span>
      case 'invites_revoked_project_deleted_by_moderator':
        return <span>Все приглашения в проект <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отозваны. Проект был удален модератором</span>
      case 'invites_revoked_vacancy_deleted_by_moderator':
        return <span>Все приглашения к заявке <strong style={roleStyle}>{vacancyName}</strong> были отозваны. Заявка была удалена модератором</span>
      case 'invite_paused_owner_banned':
        return <span>Рассмотрение вашего приглашения на роль <strong style={roleStyle}>{role}</strong> в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> приостановлено. Владелец проекта заблокирован</span>
      case 'invite_resumed_owner_unbanned':
        return <span>Рассмотрение вашего приглашения на роль <strong style={roleStyle}>{role}</strong> в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> возобновлено. Владелец проекта разблокирован</span>
      case 'invites_revoked_user_deleted':
        return <span>Все полученные приглашения от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> были отозваны. Пользователь удалил свой аккаунт</span>
      default:
        return <span>Уведомление о приглашении к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong></span>
    }
  }
  // Уведомления по мероприятиям
  if (referenceType === 'event') {
    switch (eventType) {
      case 'event_deleted_by_owner':
        return <span>Мероприятие <strong style={projectStyle}>{eventName}</strong> было удалено владельцем</span>
      case 'event_deleted_by_moderator':
        return <span>Мероприятие <strong style={projectStyle}>{eventName}</strong> было удалено модератором. Причина: {reason || 'не указана'}</span>
      case 'event_deleted_members_notified':
        return <span>Мероприятие <strong style={projectStyle}>{eventName}</strong>, в котором вы участвовали, было удалено</span>
      case 'status_changed':
        return <span>Статус мероприятия <strong style={projectStyle}>{eventName}</strong> был изменён на <strong style={statusStyle}>{status}</strong></span>
      default:
        return <span>Уведомление о мероприятии <strong style={projectStyle}>{eventName}</strong></span>
    }
  }

  // Уведомления по заявкам к мероприятиям
  if (referenceType === 'application') {
    switch (eventType) {
      case 'application_received':
        return <span><strong style={nicknameStyle}>{nickname}</strong> подал(а) заявку на мероприятие <strong style={projectStyle}>{eventName}</strong></span>
      case 'application_resubmitted':
        return <span><strong style={nicknameStyle}>{nickname}</strong> повторно отправил(а) заявку на мероприятие <strong style={projectStyle}>{eventName}</strong></span>
      case 'application_withdrawn':
        return <span><strong style={nicknameStyle}>{nickname}</strong> отозвал(а) заявку на мероприятие <strong style={projectStyle}>{eventName}</strong></span>
      case 'application_accepted':
        return <span>Ваша заявка на мероприятие <strong style={projectStyle}>{eventName}</strong> принята.{note}</span>
      case 'application_rejected':
        return <span>Ваша заявка на мероприятие <strong style={projectStyle}>{eventName}</strong> отклонена.{note}</span>
      case 'application_revision':
        return <span>Организатор просит доработать вашу заявку на мероприятие <strong style={projectStyle}>{eventName}</strong>.{note}</span>
      case 'application_revoked_event_deleted':
        return <span>Ваша заявка на мероприятие <strong style={projectStyle}>{eventName}</strong> была отменена в связи с удалением мероприятия</span>
      default:
        return <span>Уведомление о заявке на мероприятие</span>
    }
  }

  // Уведомления к комментарию
  if (referenceType === 'comment') {
    switch (eventType) {
      case 'comment_mention':
        return <span><strong style={nicknameStyle}>{nickname}</strong> упомянул(а) вас в комментарии</span>
      case 'comment_reply':
        return <span><strong style={nicknameStyle}>{nickname}</strong> ответил(а) на ваш комментарий к <strong style={projectStyle}>{targetName}</strong></span>
      case 'comment_new':
        return <span><strong style={nicknameStyle}>{nickname}</strong> оставил(а) комментарий к <strong style={projectStyle}>{targetName}</strong></span>
      case 'comment_deleted_by_moderator':
        return <span>Ваш комментарий к <strong style={projectStyle}>{targetName}</strong> был удалён модератором</span>
      case 'comment_deleted_by_owner':
        return <span>Ваш комментарий к <strong style={projectStyle}>{targetName}</strong> был удалён владельцем</span>
      default:
        return <span>Новое действие в комментариях</span>
    }
  }

  return <span>Уведомление</span>
}

const NO_LINK = /deleted|revoked|owner_banned|^removed/

export const getNotificationLink = (n: NotificationData, userId: string | null): string | null => {
  if (!userId) return null
  const t = n.contextData?.eventType ?? ''
  if (!['comment'].includes(n.referenceType) && NO_LINK.test(t)) return null
  const id = n.referenceId
  switch (n.referenceType) {
    case 'project': case 'response': case 'invite':
      return `/profile/${userId}/activity/project/${id}`
    case 'event':
      return `/profile/${userId}/activity/event/${id}`
    case 'application':
      return (t === 'application_received' || t === 'application_resubmitted') && n.contextData?.applicationId
        ? `/profile/${userId}/activity/event/${id}/applications/${n.contextData.applicationId}`
        : `/profile/${userId}/activity/event/${id}`
    case 'comment':
      return `/profile/${userId}/activity/${n.contextData?.refType === 'event' ? 'event' : 'project'}/${id}`
    default:
      return null
  }
}