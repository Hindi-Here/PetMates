import './project_public_view.scss'
import LockIcon from '@icons/lock.svg?react'

import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSystemRole } from '../hooks/useSystemRole'
import { queryKeys } from '../scripts/query/queryKeys'
import { projectsApi } from '../services/project'
import { projectMembersApi, type ProjectMemberData } from '../services/project_members'
import { usersApi, type UserData } from '../services/users'
import { vacanciesApi } from '../services/vacancy'
import { ProjectPublicView, type TeamMemberWithUser } from './project_public_view'

export default function ProjectViewer() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const currentSystemRole = useSystemRole()

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: queryKeys.projects.byId(projectId!),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: ownerData, isLoading: ownerLoading } = useQuery({
    queryKey: ['users', 'byId', project?.ownerId],
    queryFn: () => usersApi.getUserById(project!.ownerId),
    enabled: !!project?.ownerId,
  })

  const { data: teamMembers = [] } = useQuery<TeamMemberWithUser[]>({
    queryKey: queryKeys.projects.memberProjects(projectId!),
    queryFn: async () => {
      if (!projectId) return []
      const members = await projectMembersApi.getByProject(projectId)
      const proj = await projectsApi.getProject(projectId)

      const membersWithUsers: TeamMemberWithUser[] = members.map((member: ProjectMemberData) => ({
        memberId: member.memberId,
        projectId: member.projectId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        isOwner: member.userId === proj.ownerId,
        userData: {
          userId: member.userId,
          nickname: member.nickname,
          avatarUrl: member.avatarUrl,
          realName: member.realName,
          age: member.age,
          city: member.city,
          workplace: member.workplace,
          profileRole: member.profileRole,
          systemRole: member.systemRole,
          isBanned: member.isBanned,
          hardSkills: member.hardSkills,
          softSkills: member.softSkills,
          lastOnlineAt: member.lastOnlineAt,
          isOnline: member.isOnline,
          lastSeen: member.lastSeen,
        } as UserData,
      }))

      return membersWithUsers.sort((a, b) => {
        if (!a.joinedAt || !b.joinedAt) return 0
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      })
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const { data: vacancies = [] } = useQuery({
    queryKey: queryKeys.vacancies.byProject(projectId!),
    queryFn: () => vacanciesApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })

  const isStaff = currentSystemRole === 'admin' || currentSystemRole === 'moderator'
  const isBanned = ownerData?.isBanned === true

  if (projectLoading || ownerLoading) {
    return <div className='loading-container' />
  }

  if (!project || (!isStaff && (!ownerData || isBanned))) {
    return (
      <div className='banned-gate'>
        <div className='info-container'>
          <LockIcon className='info-ico' />
          <p className='info-comment'>Проект недоступен</p>
          <p className='info-subcomment'>Владелец проекта заблокирован</p>
        </div>
      </div>
    )
  }

  const handleBack = () => navigate(`/profile/${project.ownerId}/activity`, { replace: true })

  return (
    <div className='project-page'>
      <ProjectPublicView
        data={{
          projectId: project.projectId,
          ownerId: project.ownerId,
          ownerSystemRole: ownerData?.systemRole,
          title: project.title,
          status: project.status,
          description: project.fullDescription ?? '',
          isPrivate: project.isPrivate ?? false,
          ratingCount: project.ratingCount ?? 0,
        }}
        team={teamMembers}
        vacancies={vacancies}
        onBack={handleBack}
      />
    </div>
  )
}