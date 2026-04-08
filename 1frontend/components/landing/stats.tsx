const stats = [
  { value: '12,000+', label: 'Active Students' },
  { value: '840', label: 'Faculty Members' },
  { value: '99.4%', label: 'Uptime SLA' },
  { value: '18 hrs', label: 'Avg. Resolution Time' },
]

export function Stats() {
  return (
    <section className="border-y border-border bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold text-primary">{s.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}