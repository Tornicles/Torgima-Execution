# DOC 32: MONITORING & OPERATIONS

## SECTION 1: MONITORING DASHBOARDS

### Main System Health Dashboard

```typescript
interface SystemHealthMetrics {
  availability: number; // 0-100 (target: > 99.9%)
  errorRate: number; // 0-1 (target: < 0.005)
  latencyP50: number; // ms (target: < 500)
  latencyP95: number; // ms (target: < 2000)
  latencyP99: number; // ms (target: < 5000)
}

interface DetailedMetrics {
  api: {
    requestCount: number;
    requestsPerSecond: number;
    errorCount: number;
    timeouts: number;
  };

  bhudhi: {
    requestCount: number;
    successRate: number;
    timeoutRate: number;
    fallbackActivationRate: number;
    averageLatency: number;
  };

  database: {
    connectionCount: number;
    activeConnections: number;
    connectionPoolWaitTime: number;
    queryCount: number;
    slowQueryCount: number;
    replicationLag: number;
  };

  frontend: {
    pageLoadTime: number;
    interactiveTime: number;
    errorRate: number;
    crashRate: number;
  };

  erector: {
    activePlayers: number;
    levelCompletionRate: number;
    crashRate: number;
  };
}

// React Dashboard Component
function SystemHealthDashboard({ metrics }: { metrics: SystemHealthMetrics }) {
  const getHealthColor = (value: number, min: number, max: number) => {
    if (value < min) return "critical";
    if (value < (min + max) / 2) return "warning";
    return "healthy";
  };

  return (
    <div className="health-dashboard">
      <div className="main-metrics">
        <MetricCard
          label="Availability"
          value={`${metrics.availability.toFixed(2)}%`}
          target="> 99.9%"
          status={getHealthColor(metrics.availability, 99.9, 100)}
        />

        <MetricCard
          label="Error Rate"
          value={`${(metrics.errorRate * 100).toFixed(2)}%`}
          target="< 0.5%"
          status={getHealthColor(metrics.errorRate, 0, 0.005)}
        />

        <MetricCard
          label="Latency P95"
          value={`${metrics.latencyP95}ms`}
          target="< 2000ms"
          status={getHealthColor(metrics.latencyP95, 0, 2000)}
        />
      </div>

      <div className="detailed-metrics">
        <MetricsPanel title="API" metrics={metrics.api} />
        <MetricsPanel title="Bhudhi AI" metrics={metrics.bhudhi} />
        <MetricsPanel title="Database" metrics={metrics.database} />
        <MetricsPanel title="Frontend" metrics={metrics.frontend} />
      </div>
    </div>
  );
}
```

---

## SECTION 2: ALERTING RULES

```typescript
interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  operator: ">" | "<" | "==" | "!=";
  duration: number; // seconds
  severity: "info" | "warning" | "critical";
  action: string;
  notifyChannels: string[]; // "slack", "email", "pagerduty"
}

const alertRules: AlertRule[] = [
  {
    id: "alert_high_error_rate",
    metric: "api.error_rate",
    threshold: 0.01, // 1%
    operator: ">",
    duration: 300, // 5 minutes
    severity: "critical",
    action: "trigger_rollback",
    notifyChannels: ["slack", "pagerduty"]
  },

  {
    id: "alert_bhudhi_timeout",
    metric: "bhudhi.timeout_rate",
    threshold: 0.1, // 10%
    operator: ">",
    duration: 60,
    severity: "critical",
    action: "activate_fallback",
    notifyChannels: ["slack", "pagerduty"]
  },

  {
    id: "alert_database_replication_lag",
    metric: "database.replication_lag",
    threshold: 10000, // 10 seconds
    operator: ">",
    duration: 120,
    severity: "critical",
    action: "page_dba",
    notifyChannels: ["pagerduty"]
  },

  {
    id: "alert_frontend_crash_rate",
    metric: "frontend.crash_rate",
    threshold: 0.05, // 5%
    operator: ">",
    duration: 300,
    severity: "warning",
    action: "notify_team",
    notifyChannels: ["slack"]
  },

  {
    id: "alert_signal_anomaly",
    metric: "system.signal_anomaly_count",
    threshold: 5,
    operator: ">",
    duration: 600, // 10 minutes
    severity: "warning",
    action: "investigate",
    notifyChannels: ["slack"]
  },

  // [20+ more alert rules...]
];

// Alert evaluation
class AlertingSystem {
  async evaluateAlerts(metrics: DetailedMetrics): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const rule of alertRules) {
      const metricValue = this.getMetricValue(metrics, rule.metric);

      if (this.isThresholdBreached(metricValue, rule)) {
        const duration = await this.checkDuration(rule);

        if (duration >= rule.duration) {
          triggeredAlerts.push({
            rule: rule.id,
            severity: rule.severity,
            metric: rule.metric,
            value: metricValue,
            threshold: rule.threshold,
            timestamp: new Date()
          });

          // Execute action
          await this.executeAction(rule.action);

          // Notify
          await this.notifyChannels(rule.notifyChannels, {
            rule: rule.id,
            message: `${rule.metric} is ${rule.operator} ${rule.threshold}`
          });
        }
      }
    }

    return triggeredAlerts;
  }
}
```

---

## SECTION 3: OPERATIONAL RUNBOOKS

### Runbook: High Error Rate

```markdown
# Runbook: API Error Rate > 1%

## Detection
Alert triggered: error_rate > 0.01 for 5+ minutes

## Immediate Actions (0-5 min)
1. Check error logs for patterns
2. Check recent deployments
3. Check Bhudhi service status
4. Check database health

## Investigation (5-15 min)
1. Are errors in new code? → Rollback
2. Are errors in API layer? → Restart API servers
3. Are errors in Bhudhi? → Switch to fallback
4. Are errors in database? → Check replication, failover if needed

## Resolution Path
- **New code**: Trigger rollback
- **API layer**: Restart and monitor
- **Bhudhi**: Switch fallback + investigate async
- **Database**: Failover to replica

## Follow-up (after incident resolved)
1. Document root cause
2. Add test case to prevent
3. Update monitoring if needed
4. Schedule post-mortem
```

### Runbook: Database Replication Lag > 10s

```markdown
# Runbook: Database Replication Lag Critical

## Detection
Alert: db.replication_lag > 10000ms

## Immediate Actions (0-5 min)
1. Check replica server status
2. Check network connectivity
3. Check primary database load

## Investigation (5-10 min)
1. Is replica catching up? → Monitor
2. Is primary overloaded? → Scale horizontally
3. Is network issue? → Contact infrastructure

## Resolution
- **Catching up**: Let it continue, extend timeout
- **Overloaded**: Scale primary, reduce connections
- **Network**: Contact infrastructure team

## Escalation
If lag > 30s: Page DBA on-call
```

---

## SECTION 4: SLO & SLA TARGETS

```typescript
interface SLO {
  metric: string;
  target: number;
  window: "daily" | "weekly" | "monthly" | "quarterly";
}

interface SLA {
  tier: "bronze" | "silver" | "gold" | "platinum";
  uptime: number;
  responseTime: number;
  supportLevel: string;
}

const slos: SLO[] = [
  { metric: "availability", target: 99.9, window: "monthly" },
  { metric: "error_rate", target: 0.99, window: "monthly" }, // 99% success
  { metric: "latency_p95", target: 2000, window: "monthly" }, // < 2s, 95th percentile
  { metric: "task_generation_success", target: 0.99, window: "weekly" },
  { metric: "signal_calculation_accuracy", target: 0.99, window: "weekly" }
];

const slas: SLA[] = [
  {
    tier: "bronze",
    uptime: 99.0,
    responseTime: 5000,
    supportLevel: "email support, 24h response"
  },
  {
    tier: "silver",
    uptime: 99.5,
    responseTime: 2000,
    supportLevel: "priority email, 4h response"
  },
  {
    tier: "gold",
    uptime: 99.9,
    responseTime: 1000,
    supportLevel: "24/7 phone + email, 1h response"
  },
  {
    tier: "platinum",
    uptime: 99.95,
    responseTime: 500,
    supportLevel: "dedicated account manager, 15min response"
  }
];
```

---

## SECTION 5: OPERATIONS TEAM RESPONSIBILITIES

```typescript
interface OnCallSchedule {
  role: string;
  responsibilities: string[];
  escalationPath: string[];
  pagingRules: string[];
}

const oncallSchedule: OnCallSchedule[] = [
  {
    role: "Backend on-call engineer",
    responsibilities: [
      "Monitor API error rates",
      "Respond to database alerts",
      "Handle deployment issues",
      "Investigate service outages"
    ],
    escalationPath: [
      "Alert team in Slack",
      "Page on-call if critical",
      "Escalate to team lead if unresolved in 15min"
    ],
    pagingRules: [
      "Error rate > 5%",
      "Latency p95 > 5000ms",
      "Service unavailable",
      "Database replication lag > 30s"
    ]
  },

  {
    role: "Frontend on-call engineer",
    responsibilities: [
      "Monitor frontend error rates",
      "Investigate client-side crashes",
      "Handle WebSocket issues",
      "Monitor state management"
    ],
    escalationPath: ["Alert team", "Page if crash rate > 10%"],
    pagingRules: [
      "Frontend crash rate > 5%",
      "Page load time > 5s",
      "Real-time updates not working"
    ]
  },

  {
    role: "Bhudhi AI on-call engineer",
    responsibilities: [
      "Monitor Bhudhi API latency",
      "Handle prompt library issues",
      "Investigate response validation failures",
      "Monitor fallback activation"
    ],
    escalationPath: ["Alert team", "Page if success rate < 95%"],
    pagingRules: [
      "Bhudhi timeout rate > 10%",
      "Fallback activation > 20%",
      "Response validation failure > 5%"
    ]
  }
];
```

