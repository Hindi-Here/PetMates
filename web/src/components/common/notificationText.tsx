import InfoIcon from '@icons/info.svg?react'
import AcceptIcon from '@icons/accept.svg?react'
import RejectIcon from '@icons/reject.svg?react'
import type { NotificationData } from '../services/notification'

export const getNotificationIcon = (referenceType: string, contextData: any) => {
  const eventType = contextData?.eventType

  if (referenceType === 'project') {
    if (eventType === 'removed' || eventType === 'removed_self' || 
        eventType === 'project_deleted' || eventType === 'owner_banned' || 
        eventType === 'owner_deleted') {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else if (eventType === 'added' || eventType === 'added_self') {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  if (referenceType === 'response') {
    if (eventType === 'response_accepted') {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else if (eventType === 'response_rejected' || eventType === 'response_cancelled') {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  if (referenceType === 'invite') {
    if (eventType === 'invite_accepted') {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    } else if (eventType === 'invite_rejected' || eventType === 'invite_cancelled') {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    } else {
      return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
    }
  }

  return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
}

export const getNotificationText = (notification: NotificationData) => {
  const { referenceType, contextData } = notification
  const eventType = contextData?.eventType
  const nickname = contextData?.nickname
  const projectName = contextData?.projectName || 'Проект'
  const vacancyName = contextData?.vacancyName || 'Заявка'
  const role = contextData?.role
  const status = contextData?.status

  const nicknameStyle = { fontWeight: 600, fontStyle: 'italic' }
  const projectStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const roleStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const statusStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }

  if (referenceType === 'project') {
    switch (eventType) {
      case 'added':
        return (
          <span>
            <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> был добавлен в проект{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> в качестве{' '}
            <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'added_self':
        return (
          <span>
            Вы были добавлены в проект{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> в качестве{' '}
            <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'removed':
        return (
          <span>
            <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> был исключен из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>
          </span>
        )
      case 'removed_self':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>
          </span>
        )
      case 'role_changed':
        return (
          <span>
            Роль <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> была изменена на{' '}
            <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'role_changed_self':
        return (
          <span>
            Ваша роль в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> была изменена на{' '}
            <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'status_changed':
        return (
          <span>
            Статус проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> был изменен на{' '}
            <strong style={statusStyle}>{status}</strong>
          </span>
        )
      case 'owner_banned':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. 
            Владелец проекта получил бан
          </span>
        )
      case 'project_deleted':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. 
            Проект был удален
          </span>
        )
      case 'owner_deleted':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>. 
            Владелец удалил свой аккаунт
          </span>
        )
      default:
        return (
          <span>
            Уведомление о проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>
          </span>
        )
    }
  }

  if (referenceType === 'response') {
    switch (eventType) {
      case 'response_sent':
        return (
          <span>
            Отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> был отправлен
          </span>
        )
      case 'response_accepted':
        return (
          <span>
            Отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> был принят
          </span>
        )
      case 'response_rejected':
        return (
          <span>
            Ваш отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> был отклонен
          </span>
        )
      case 'responses_revoked_owner_deleted':
        return (
          <span>
            Все отклики к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> были отозваны. 
            Владелец проекта удалил свой аккаунт
          </span>
        )
      case 'responses_revoked_project_deleted':
        return (
          <span>
            Все отклики к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отозваны. 
            Проект был удален
          </span>
        )
      case 'responses_revoked_vacancy_deleted':
        return (
          <span>
            Все отклики к заявке <strong style={roleStyle}>{vacancyName}</strong> были отозваны. 
            Заявка была удалена
          </span>
        )
      case 'response_received':
        return (
          <span>
            Вы получили отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong>
          </span>
        )
      case 'responses_revoked_user_deleted':
        return (
          <span>
            Все полученные отклики от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> были отозваны. 
            Пользователь удалил свой аккаунт
          </span>
        )
      case 'response_cancelled':
        return (
          <span>
            Полученный отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> был отозван. 
            Отклик отменен отправителем
          </span>
        )
      default:
        return (
          <span>
            Уведомление об отклике к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>
          </span>
        )
    }
  }

  if (referenceType === 'invite') {
    switch (eventType) {
      case 'invite_sent':
        return (
          <span>
            Приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> было отправлено
          </span>
        )
      case 'invite_accepted':
        return (
          <span>
            Приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> было принято
          </span>
        )
      case 'invite_rejected':
        return (
          <span>
            Ваше приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> было отклонено
          </span>
        )
      case 'invites_revoked_owner_deleted':
        return (
          <span>
            Все приглашения к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong> были отозваны. 
            Владелец проекта удалил свой аккаунт
          </span>
        )
      case 'invites_revoked_project_deleted':
        return (
          <span>
            Все приглашения к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> были отозваны. 
            Проект был удален
          </span>
        )
      case 'invites_revoked_vacancy_deleted':
        return (
          <span>
            Все приглашения к заявке <strong style={roleStyle}>{vacancyName}</strong> были отозваны. 
            Заявка была удалена
          </span>
        )
      case 'invite_received':
        return (
          <span>
            Вы получили приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong>
          </span>
        )
      case 'invites_revoked_user_deleted':
        return (
          <span>
            Все полученные приглашения от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> были отозваны. 
            Пользователь удалил свой аккаунт
          </span>
        )
      case 'invite_cancelled':
        return (
          <span>
            Полученное приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong> к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong> на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> было отозвано. 
            Приглашение отменено отправителем
          </span>
        )
      default:
        return (
          <span>
            Уведомление о приглашении к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>
          </span>
        )
    }
  }

  return <span>Уведомление</span>
}