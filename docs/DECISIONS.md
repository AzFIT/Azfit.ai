# Decisions

- **Supabase Realtime for messaging**: chosen to avoid building and operating a separate chat server; Postgres changes are pushed directly to subscribed clients.
- **Sessions are their own table with RLS**: keeps multi-tenant data isolated; trainers manage their own rows while clients can only view/request/cancel their own sessions.
- **/messages is a shared route for both roles**: both trainer and client conversations render from the same conversation list, reducing duplicated UI and routing logic.
- **Breadcrumbs only on nested pages**: mobile screen space is limited, so breadcrumbs are shown on nested views (e.g. client profile, program builder) and omitted from top-level dashboards.
- **skinfold_assessments table separate from body_composition**: skinfold sites and protocol-specific math live in their own table, while body_composition remains the source for weight/tape/BF% trend charts.
- **Katch-McArdle TDEE alongside Mifflin-St Jeor**: TDEE card offers both equations so clients can choose when a recent BF% estimate is available.
- **Progress photos / storage bucket deferred**: storage buckets and upload flows will be built in a later phase; ProgressPhotos page remains in place as a placeholder.
