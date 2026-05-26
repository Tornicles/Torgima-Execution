# Bhudhi 2.0 Release Notes

**Release Date:** TBD  
**Version:** 2.0.0

## What's new

### Five core systems

- Investigation System (13 engines)
- Intelligence System (12 engines)
- Operating System (10 engines)
- Security System
- Preservation System

### Key features

- Unified Cognitive Kernel
- Event-driven architecture
- Memory Graph for knowledge storage
- BHUDHI:// Protocol for communication
- Universal Execution Runtime
- Universal Dashboard (`/app/bhudhi`)

### Integration

- Deep Torgima integration (Prompt 39 convergence layer)
- Seamless goal-to-execution flow
- Real-time intelligence guidance

### Launch (Prompt 40)

- Multi-environment config (development / staging / production)
- Pricing tiers (Free / Pro / Enterprise) mapped to Torgima `starter` / `growth` / `ultimate`
- Bhudhi onboarding at `/app/bhudhi/onboarding`
- Telemetry ingestion at `POST /api/telemetry`
- Launch dashboard at `/app/bhudhi/launch`

## Performance

- P99 latency target: &lt; 100ms (see certification benchmarks)
- Uptime target: 99.9%
- Success rate target: &gt; 99%

## Security

- Rate limiting active in staging/production
- Authentication required on user-scoped routes
- Audit logging enabled
- Data encryption at rest (Postgres provider)

## Breaking changes

None — backward compatible with existing Torgima onboarding and blueprint flows.

## Known issues

None identified at release candidate.

## Support

- Documentation: repository `docs/` folder
- Deployment: [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md), [`docs/DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)
- Support: support@tornicles.com
- Issues: GitHub — Tornicles/Torgima-Execution

## Thank you

Thank you for adopting Bhudhi 2.0.
