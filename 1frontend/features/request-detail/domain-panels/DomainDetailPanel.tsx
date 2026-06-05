'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RequestDetailViewModel } from '@/features/request-detail/types'
import { formatDate, humanize, titleize } from '@/features/request-detail/utils'
import { useOptionalT } from '@/lib/optional-t'

function FieldGrid({
  fields,
}: {
  fields: Array<{ label: string; value: string | null }>
}) {
  const visible = fields.filter((field) => field.value)

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No domain-specific data available.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((field) => (
        <div key={field.label} className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field.label}
          </p>
          <p className="break-words text-sm text-foreground">{field.value}</p>
        </div>
      ))}
    </div>
  )
}

function GenericDomainPanel({
  data,
}: {
  data: Record<string, unknown> | null
}) {
  const tt = useOptionalT()
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        {tt('detail.noDomainOverview', 'No domain overview is available.')}
      </p>
    )
  }

  const fields = Object.entries(data).map(([key, value]) => ({
    label: titleize(key),
    value:
      value === null || value === undefined || typeof value === 'object'
        ? null
        : String(value),
  }))

  if (fields.filter((f) => f.value).length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {tt('detail.noDomainData', 'No domain-specific data available.')}
      </p>
    )
  }

  return <FieldGrid fields={fields} />
}

function EquipmentDetailPanel({ data }: { data: Record<string, unknown> }) {
  return (
    <FieldGrid
      fields={[
        { label: 'Equipment Name', value: String(data.equipmentName ?? '') || null },
        { label: 'Category', value: String(data.equipmentCategory ?? '') || null },
        { label: 'Quantity', value: data.quantity ? String(data.quantity) : null },
        { label: 'Purpose', value: String(data.purpose ?? '') || null },
        {
          label: 'Needed From',
          value: data.neededFrom ? formatDate(String(data.neededFrom)) : null,
        },
        {
          label: 'Needed Until',
          value: data.neededUntil ? formatDate(String(data.neededUntil)) : null,
        },
        {
          label: 'Stock Check',
          value: data.stockCheckStatus ? humanize(String(data.stockCheckStatus)) : null,
        },
        {
          label: 'Procurement Required',
          value:
            data.procurementRequired === undefined
              ? null
              : data.procurementRequired
                ? 'Yes'
                : 'No',
        },
        {
          label: 'Estimated Cost',
          value: data.estimatedCost ? `$${data.estimatedCost}` : null,
        },
        { label: 'Urgency Reason', value: String(data.urgencyReason ?? '') || null },
      ]}
    />
  )
}

function TicketDetailPanel({ data }: { data: Record<string, unknown> }) {
  return (
    <FieldGrid
      fields={[
        { label: 'Category', value: String(data.category ?? '') || null },
        { label: 'Subcategory', value: String(data.subcategory ?? '') || null },
        { label: 'Affected System', value: String(data.affectedSystem ?? '') || null },
        { label: 'Asset ID', value: String(data.assetId ?? '') || null },
        { label: 'Location', value: String(data.locationText ?? '') || null },
        {
          label: 'Ticket Status',
          value: data.ticketStatus ? humanize(String(data.ticketStatus)) : null,
        },
        {
          label: 'Incident Started',
          value: data.incidentStartedAt
            ? formatDate(String(data.incidentStartedAt), true)
            : null,
        },
        {
          label: 'Resolved At',
          value: data.resolvedAt ? formatDate(String(data.resolvedAt), true) : null,
        },
        {
          label: 'Reopened Count',
          value: data.reopenedCount !== undefined ? String(data.reopenedCount) : null,
        },
        {
          label: 'Assigned IT Agent',
          value:
            (data.assignedTo as { fullName?: string } | undefined)?.fullName ?? null,
        },
        {
          label: 'Resolution Summary',
          value: String(data.resolutionSummary ?? '') || null,
        },
      ]}
    />
  )
}

function formatTR(value: string | Date | null | undefined, includeTime = true) {
  if (!value) return '-'
  const d = new Date(value as string)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Europe/Istanbul',
  })
}

function AppointmentDetailPanel({ data }: { data: Record<string, unknown> }) {
  const tt = useOptionalT()
  return (
    <FieldGrid
      fields={[
        { label: tt('detail.apptPerson', 'Kişi'), value: String(data.targetUser ?? '') || null },
        { label: tt('detail.apptType', 'Randevu Türü'), value: String(data.appointmentType ?? '').replace(/_/g, ' ') || null },
        { label: tt('detail.apptTopic', 'Konu'), value: String(data.topic ?? '') || null },
        { label: tt('detail.apptDetails', 'Detaylar'), value: String(data.details ?? '') || null },
        {
          label: tt('detail.apptStart', 'Tercih Edilen Başlangıç'),
          value: data.preferredStartAt ? formatTR(String(data.preferredStartAt)) : null,
        },
        {
          label: tt('detail.apptEnd', 'Tercih Edilen Bitiş'),
          value: data.preferredEndAt ? formatTR(String(data.preferredEndAt)) : null,
        },
      ]}
    />
  )
}

function InternshipDetailPanel({ data }: { data: Record<string, unknown> }) {
  return (
    <FieldGrid
      fields={[
        { label: 'Company Name', value: String(data.companyName ?? '') || null },
        { label: 'Company Sector', value: String(data.companySector ?? '') || null },
        { label: 'Contact Name', value: String(data.companyContactName ?? '') || null },
        { label: 'Contact Email', value: String(data.companyContactEmail ?? '') || null },
        { label: 'Internship Type', value: String(data.internshipType ?? '') || null },
        { label: 'Work Mode', value: String(data.workMode ?? '') || null },
        {
          label: 'Start Date',
          value: data.startDate ? formatDate(String(data.startDate)) : null,
        },
        { label: 'End Date', value: data.endDate ? formatDate(String(data.endDate)) : null },
        {
          label: 'Duration Days',
          value: data.durationDays ? String(data.durationDays) : null,
        },
        {
          label: 'Insurance Required',
          value:
            data.insuranceRequired === undefined
              ? null
              : data.insuranceRequired
                ? 'Yes'
                : 'No',
        },
      ]}
    />
  )
}

export function DomainDetailPanel({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  const tt = useOptionalT()
  const key = detail.requestType.key.toUpperCase()
  const data = detail.domainData

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tt('detail.domainOverview', 'Domain Overview')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data && key.includes('EQUIPMENT') ? (
          <EquipmentDetailPanel data={data} />
        ) : data && (key.includes('TICKET') || key.includes('IT_SUPPORT')) ? (
          <TicketDetailPanel data={data} />
        ) : data && key.includes('INTERNSHIP') ? (
          <InternshipDetailPanel data={data} />
        ) : data && key.includes('APPOINTMENT') ? (
          <AppointmentDetailPanel data={data} />
        ) : (
          <GenericDomainPanel data={data} />
        )}
      </CardContent>
    </Card>
  )
}
