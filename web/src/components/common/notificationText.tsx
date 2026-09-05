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
        'owner_deleted', 'project_deleted_by_moderator', 'moderator_deleted_project'
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
        'moderator_deleted_vacancy', 'responses_revoked_project_deleted',
        'responses_revoked_vacancy_deleted', 'responses_revoked_project_deleted_by_moderator',
        'responses_revoked_vacancy_deleted_by_moderator', 'response_paused_owner_banned',
        'response_resumed_owner_unbanned'
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
    if (
      ['promoted_to_admin', 'promoted_to_moderator', 'moderator_promoted_user', 'moderator_unbanned_user'].includes(eventType)
    ) {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    }
    if (
      ['demoted_from_admin', 'demoted_from_moderator', 'moderator_demoted_user', 'moderator_banned_user'].includes(eventType)
    ) {
      return { icon: RejectIcon, color: 'reject', borderColor: 'var(--important-color)' }
    }
    if (eventType === 'unbanned') {
      return { icon: AcceptIcon, color: 'accept', borderColor: 'var(--success-color)' }
    }
    return { icon: InfoIcon, color: 'info', borderColor: 'var(--info-color)' }
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
  const reason = contextData?.reason

  const nicknameStyle = { fontWeight: 600, fontStyle: 'italic' }
  const projectStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const roleStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }
  const statusStyle = { fontWeight: 600, fontStyle: 'italic', color: 'var(--primary-accent)' }

  // Системные уведомления
  if (referenceType === 'system') {
    switch (eventType) {
      case 'promoted_to_admin':
        return (
          <span>
            Вас назначили <strong style={roleStyle}>администратором</strong>
          </span>
        )
      case 'promoted_to_moderator':
        return (
          <span>
            Вас назначили <strong style={roleStyle}>модератором</strong>
          </span>
        )
      case 'demoted_from_admin':
        return (
          <span>
            С вас сняли роль <strong style={roleStyle}>администратора</strong>
          </span>
        )
      case 'demoted_from_moderator':
        return (
          <span>
            С вас сняли роль <strong style={roleStyle}>модератора</strong>
          </span>
        )
      case 'unbanned':
        return (
          <span>
            Вы были разблокированы
          </span>
        )
      case 'moderator_promoted_user':
        return (
          <span>
            Вы назначили пользователя <strong style={nicknameStyle}>{nickname}</strong>{' '}
            на роль <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'moderator_demoted_user':
        return (
          <span>
            Вы сняли роль <strong style={roleStyle}>{role}</strong>{' '}
            с пользователя <strong style={nicknameStyle}>{nickname}</strong>
          </span>
        )
      case 'moderator_unbanned_user':
        return (
          <span>
            Вы разблокировали пользователя <strong style={nicknameStyle}>{nickname}</strong>
          </span>
        )
      case 'moderator_banned_user':
        return (
          <span>
            Вы заблокировали пользователя <strong style={nicknameStyle}>{nickname}</strong>
          </span>
        )
      default:
        return (
          <span>Системное уведомление</span>
        )
    }
  }

  // Уведомления по проекту
  if (referenceType === 'project') {
    switch (eventType) {
      case 'added':
        return (
          <span>
            <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            был добавлен в проект{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            в качестве <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'added_self':
        return (
          <span>
            Вы были добавлены в проект{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            в качестве <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'removed':
        return (
          <span>
            <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            был исключен из проекта{' '}
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
            Роль <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong>{' '}
            в проекте <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            была изменена на <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'role_changed_self':
        return (
          <span>
            Ваша роль в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            была изменена на <strong style={roleStyle}>{role}</strong>
          </span>
        )
      case 'status_changed':
        return (
          <span>
            Статус проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            был изменен на <strong style={statusStyle}>{status}</strong>
          </span>
        )
      case 'owner_banned':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>.{' '}
            Владелец проекта получил бан
          </span>
        )
      case 'project_deleted':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>.{' '}
            Проект был удален
          </span>
        )
      case 'owner_deleted':
        return (
          <span>
            Вы были исключены из проекта{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>.{' '}
            Владелец удалил свой аккаунт
          </span>
        )
      case 'project_deleted_by_moderator':
        return (
          <span>
            Ваш проект <strong style={projectStyle}>{projectName}</strong>{' '}
            был удалён модератором.{' '}
            Причина: {reason || 'не указана'}
          </span>
        )
      case 'moderator_deleted_project':
        return (
          <span>
            Вы удалили проект <strong style={projectStyle}>{projectName}</strong>.{' '}
            Причина: {reason || 'не указана'}
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

  // Уведомления по откликам
  if (referenceType === 'response') {
    switch (eventType) {
      case 'response_sent':
        return (
          <span>
            Отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> был отправлен
          </span>
        )
      case 'response_accepted':
        return (
          <span>
            Отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> был принят
          </span>
        )
      case 'response_rejected':
        return (
          <span>
            Ваш отклик на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> был отклонен
          </span>
        )
      case 'responses_revoked_owner_deleted':
        return (
          <span>
            Все отклики к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong>{' '}
            были отозваны. Владелец проекта удалил свой аккаунт
          </span>
        )
      case 'responses_revoked_project_deleted':
        return (
          <span>
            Все отклики к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            были отозваны. Проект был удален
          </span>
        )
      case 'responses_revoked_vacancy_deleted':
        return (
          <span>
            Все отклики к заявке <strong style={roleStyle}>{vacancyName}</strong>{' '}
            были отозваны. Заявка была удалена
          </span>
        )
      case 'responses_revoked_project_deleted_by_moderator':
        return (
          <span>
            Все отклики к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            были отменены. Проект был удален модератором
          </span>
        )
      case 'responses_revoked_vacancy_deleted_by_moderator':
        return (
          <span>
            Все отклики к заявке <strong style={roleStyle}>{vacancyName}</strong>{' '}
            были отменены. Заявка была удалена модератором
          </span>
        )
      case 'response_paused_owner_banned':
        return (
          <span>
            Рассмотрение вашего отклика на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            приостановлено. Владелец проекта заблокирован
          </span>
        )
      case 'response_resumed_owner_unbanned':
        return (
          <span>
            Рассмотрение вашего отклика на роль{' '}
            <strong style={roleStyle}>{vacancyName}</strong> в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            возобновлено. Владелец проекта разблокирован
          </span>
        )
      case 'response_received':
        return (
          <span>
            Вы получили отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong>
          </span>
        )
      case 'responses_revoked_user_deleted':
        return (
          <span>
            Все полученные отклики от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            были отозваны. Пользователь удалил свой аккаунт
          </span>
        )
      case 'response_cancelled':
        return (
          <span>
            Полученный отклик от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> был отозван.{' '}
            Отклик отменен отправителем
          </span>
        )
      case 'vacancy_deleted_by_moderator':
        return (
          <span>
            Ваша заявка <strong style={roleStyle}>{vacancyName}</strong>{' '}
            была удалена модератором.{' '}
            Причина: {reason || 'не указана'}
          </span>
        )
      case 'moderator_deleted_vacancy':
        return (
          <span>
            Вы удалили заявку <strong style={roleStyle}>{vacancyName}</strong>.{' '}
            Причина: {reason || 'не указана'}
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

  // Уведомления по приглашениям
  if (referenceType === 'invite') {
    switch (eventType) {
      case 'invite_sent':
        return (
          <span>
            Приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> было отправлено
          </span>
        )
      case 'invite_accepted':
        return (
          <span>
            Приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> было принято
          </span>
        )
      case 'invite_rejected':
        return (
          <span>
            Ваше приглашение на участие в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> было отклонено
          </span>
        )
      case 'invites_revoked_owner_deleted':
        return (
          <span>
            Все приглашения к проектам <strong style={nicknameStyle}>{nickname || 'пользователя'}</strong>{' '}
            были отозваны. Владелец проекта удалил свой аккаунт
          </span>
        )
      case 'invites_revoked_project_deleted':
        return (
          <span>
            Все приглашения к проекту{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            были отозваны. Проект был удален
          </span>
        )
      case 'invites_revoked_vacancy_deleted':
        return (
          <span>
            Все приглашения к заявке <strong style={roleStyle}>{vacancyName}</strong>{' '}
            были отозваны. Заявка была удалена
          </span>
        )
      case 'invites_revoked_project_deleted_by_moderator':
        return (
          <span>
            Все приглашения в проект{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            были отозваны. Проект был удален модератором
          </span>
        )
      case 'invites_revoked_vacancy_deleted_by_moderator':
        return (
          <span>
            Все приглашения к заявке <strong style={roleStyle}>{vacancyName}</strong>{' '}
            были отозваны. Заявка была удалена модератором
          </span>
        )
      case 'invite_paused_owner_banned':
        return (
          <span>
            Рассмотрение вашего приглашения на роль{' '}
            <strong style={roleStyle}>{role}</strong> в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            приостановлено. Владелец проекта заблокирован
          </span>
        )
      case 'invite_resumed_owner_unbanned':
        return (
          <span>
            Рассмотрение вашего приглашения на роль{' '}
            <strong style={roleStyle}>{role}</strong> в проекте{' '}
            <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            возобновлено. Владелец проекта разблокирован
          </span>
        )
      case 'invite_received':
        return (
          <span>
            Вы получили приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong>
          </span>
        )
      case 'invites_revoked_user_deleted':
        return (
          <span>
            Все полученные приглашения от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            были отозваны. Пользователь удалил свой аккаунт
          </span>
        )
      case 'invite_cancelled':
        return (
          <span>
            Полученное приглашение от <strong style={nicknameStyle}>{nickname || 'Пользователь'}</strong>{' '}
            к проекту <strong style={projectStyle} onClick={(e) => { e.stopPropagation() }}>{projectName}</strong>{' '}
            на роль <strong style={roleStyle}>{vacancyName}</strong> было отозвано.{' '}
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