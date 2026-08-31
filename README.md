# Campus Sports Hub

Build a production-ready, deployable full-stack web application called “SportsHub” for a college sports facility booking system.

IMPORTANT:

Do NOT build this as a static UI mockup or a simple landing page.

Build a functional MVP that I can directly deploy after generation. All major user interactions, navigation, booking states, forms, filters, responsive layouts, and dashboards should work.

The application is designed for a college campus and solves the problem of students booking sports facilities and time slots. The most important technical requirement is CONCURRENCY-SAFE BOOKING: if multiple users try to book the exact same facility and time slot simultaneously, only ONE booking must succeed and duplicate bookings must never be created.

==================================================

1. PRODUCT VISION

==================================================

Product name:

SportsHub

Tagline:

“Book your game. Own your time.”

SportsHub is a centralized sports facility booking platform where students can:

• Discover campus sports facilities

• View real-time availability

• Select dates and time slots

• Book facilities

• Cancel bookings

• Join waitlists

• Get alternative slot recommendations

• Receive booking notifications

• View booking history

Admins can:

• Manage facilities

• Manage operating hours

• Mark facilities under maintenance

• View bookings

• Monitor facility utilization

• View analytics

• Manage availability

The application should feel like a real product that could actually be used by a college, not a hackathon-only prototype.

==================================================

2. DESIGN DIRECTION

==================================================

Create a premium, modern SaaS-style interface.

Visual style:

• Clean

• Minimal

• Professional

• Modern college-tech product

• Strong visual hierarchy

• Plenty of whitespace

• Rounded cards

• Subtle shadows

• Smooth transitions

• High-quality icons

• Consistent spacing

• Excellent typography

Use a professional dark navy / blue based visual identity with subtle gradients.

Do NOT overuse gradients, glassmorphism, excessive animations, or unnecessary decorative elements.

The interface should look polished enough for:

• Real deployment

• Hackathon presentation

• Screenshots in pitch deck

• Mobile usage

==================================================

3. TOP NAVBAR — VERY IMPORTANT

==================================================

DO NOT use a left sidebar.

Use a proper TOP NAVBAR across the application.

Desktop navbar:

LEFT:

SportsHub logo + name

CENTER / NAVIGATION:

• Dashboard

• Explore

• My Bookings

• Waitlist

RIGHT:

• Notifications icon

• User profile/avatar

• User name

• Dropdown menu

For admin users:

Add:

• Admin Dashboard

Navbar should remain clean and compact.

Make the navbar sticky at the top while scrolling.

Mobile navbar:

Use a responsive top navbar.

LEFT:

SportsHub logo

RIGHT:

• Notification icon

• Hamburger menu

Opening the hamburger should show a clean mobile navigation menu.

Never allow the desktop navbar to overflow on mobile.

==================================================

4. RESPONSIVE DESIGN — VERY IMPORTANT

==================================================

The application MUST be fully responsive.

Design and test for:

• Desktop

• Laptop

• Tablet

• Mobile phones

The mobile experience must NOT simply be a scaled-down desktop version.

On mobile:

• Cards become single-column

• Tables become responsive cards or horizontal scrolling where appropriate

• Filters become compact controls / bottom sheets

• Booking slot grid remains easy to tap

• Buttons should have comfortable touch targets

• Navbar becomes mobile-friendly

• Text should never overflow

• No horizontal page scrolling

• Modals should fit within the viewport

• Charts should resize properly

• Forms should be easy to use with one hand

Prioritize mobile responsiveness because students will primarily access the platform from phones.

==================================================

5. STUDENT DASHBOARD

==================================================

Create a polished dashboard.

Hero section:

“Book your game. Own your time.”

Subtitle:

“Find your facility, choose your slot, and start playing.”

Primary CTA:

“Book a Facility”

Secondary CTA:

“View My Bookings”

Show:

Upcoming Booking

• Facility

• Date

• Time

• Status

• View Booking button

Quick facility categories:

🏸 Badminton

🎾 Tennis

🏀 Basketball

⚽ Football

🏏 Cricket

🏋 Gymnasium

Show a “Popular Today” section with facility cards.

Each card:

• Facility image

• Facility name

• Location

• Availability

• View Slots button

==================================================

6. EXPLORE FACILITIES

==================================================

Create a dedicated Explore page.

Top:

“Explore Facilities”

Search bar:

“Search facilities...”

Filters:

• Sport

• Date

• Availability

• Location

Facility cards should include:

• High-quality image

• Facility name

• Location

• Capacity

• Availability status

• Number of available slots

• View Availability button

Use realistic campus sports data.

Facilities:

Badminton Court 1

Badminton Court 2

Tennis Court 1

Basketball Court

Football Ground

Cricket Ground

Gymnasium

==================================================

7. FACILITY DETAILS + BOOKING

==================================================

When a user clicks a facility, open a detailed booking page.

Example:

BADMINTON COURT 1

Show:

• Facility image

• Location

• Capacity

• Available equipment

• Operating hours

• Facility description

Date selector:

Today

Tomorrow

Next 7 days

Then show a clean slot grid.

Example:

5:00 PM – 6:00 PM

AVAILABLE

6:00 PM – 7:00 PM

AVAILABLE

7:00 PM – 8:00 PM

BOOKED

8:00 PM – 9:00 PM

AVAILABLE

States:

AVAILABLE

SELECTED

BOOKED

MAINTENANCE

Selected slot should have a clear visual state.

Bottom:

Selected:

Badminton Court 1

6:00 PM – 7:00 PM

Button:

“Confirm Booking”

==================================================

8. BOOKING FLOW

==================================================

When the user clicks Confirm Booking:

Show a confirmation modal:

“Confirm your booking?”

Facility

Date

Time

Duration

Button:

Confirm Booking

On success:

Show:

✓ Booking Confirmed

Facility:

Badminton Court 1

Date:

5 September 2026

Time:

6:00 PM – 7:00 PM

Booking ID:

SH-2026-10482

Actions:

• View Booking

• Add to Calendar

• Done

Add a subtle success animation.

==================================================

9. CONCURRENCY-SAFE BOOKING

==================================================

THIS IS THE MOST IMPORTANT TECHNICAL REQUIREMENT.

Never implement booking using only frontend availability checks.

The backend/database must be the final authority.

Implement booking using:

• Database transactions

• Unique constraint on facility + date + time slot

• Proper conflict handling

• Idempotent booking requests where appropriate

Database rule:

One facility + one date + one time slot = maximum ONE active booking.

Example unique constraint:

facility_id + booking_date + start_time

When simultaneous requests arrive:

Request A

Request B

Request C

Request D

All may reach the backend simultaneously.

Only one should receive:

BOOKING CONFIRMED

Others should receive:

SLOT ALREADY BOOKED

Never create duplicate records.

Handle database conflict gracefully and show the user:

“This slot was just booked by another student. Please select another slot.”

Do not rely on frontend state for concurrency protection.

==================================================

10. RACE CONDITION DEMO

==================================================

Create a dedicated page:

“Concurrency Demo”

This is for hackathon presentation.

Show:

Selected Facility:

Badminton Court 1

Selected Slot:

6:00 PM – 7:00 PM

Large button:

“Simulate 50 Simultaneous Requests”

When clicked:

Animate multiple requests being processed.

Show live counters:

REQUESTS

50

PROCESSING

50

SUCCESSFUL

1

REJECTED

49

DOUBLE BOOKINGS

0

DATABASE STATUS

CONSISTENT ✓

Then show request results:

User 01    ✓ BOOKED

User 02    ✕ CONFLICT

User 03    ✕ CONFLICT

User 04    ✕ CONFLICT

...

Make this visually impressive.

Add explanation:

“Database-level concurrency control guarantees that only one valid booking can be created for the same facility and time slot.”

If possible, implement this demo against the actual booking backend instead of only faking the numbers.

==================================================

11. MY BOOKINGS

==================================================

Create:

“My Bookings”

Tabs:

• Upcoming

• Completed

• Cancelled

Booking cards:

• Facility

• Date

• Time

• Booking ID

• Status

• Cancel Booking

Cancellation:

Show confirmation modal before cancellation.

After cancellation:

Update booking status

Release slot

Update availability

Trigger notification

==================================================

12. WAITLIST

==================================================

Create a dedicated Waitlist section.

When a slot is full:

“6:00 PM – 7:00 PM is currently full.”

Button:

“Join Waitlist”

After joining:

“You are #4 on the waitlist.”

Show:

• Position

• Facility

• Slot

• Joined time

• Current status

When a slot becomes available, show:

“Your requested slot is now available!”

==================================================

13. SMART ALTERNATIVES

==================================================

When a selected slot is unavailable, automatically show alternatives.

Example:

Requested:

Badminton Court 1

6:00 – 7:00 PM

FULL

Recommended:

Badminton Court 1

5:00 – 6:00 PM

Available

Badminton Court 2

6:00 – 7:00 PM

Available

Badminton Court 1

7:00 – 8:00 PM

Available

Make alternatives clickable.

==================================================

14. NOTIFICATIONS

==================================================

Create notification dropdown/page.

Examples:

✓ Booking confirmed

✓ Reminder: Your slot starts in 30 minutes

✓ Booking cancelled

✓ Waitlisted slot is now available

✓ Facility temporarily closed

✓ Alternative slot available

Use realistic timestamps.

==================================================

15. ADMIN DASHBOARD

==================================================

Create a separate Admin Dashboard accessible from the top navbar.

Dashboard statistics:

Total Facilities

Active Bookings

Today's Bookings

Utilization Rate

Example:

7

Facilities

128

Today's Bookings

84%

Utilization

Show charts:

• Bookings by day

• Facility utilization

• Peak booking hours

Facility management table/cards:

Facility

Status

Bookings

Utilization

Action

Admin actions:

• Open facility

• Close facility

• Mark under maintenance

• Update operating hours

• View bookings

==================================================

16. DATABASE DESIGN

==================================================

Use a proper relational database structure.

Tables:

users

facilities

facility_slots / schedules

bookings

waitlist

notifications

Bookings should contain:

id

user_id

facility_id

booking_date

start_time

end_time

status

created_at

Ensure the database has a unique constraint preventing duplicate active bookings for the same:

facility + date + start_time

Use proper foreign keys and indexes.

==================================================

17. AUTHENTICATION

==================================================

Implement a clean authentication flow.

Pages:

Login

Sign Up

Use college-style authentication UX.

For prototype/demo purposes, provide realistic demo accounts:

Student

Admin

Clearly label demo credentials if necessary.

Persist authentication state.

Protect admin routes.

==================================================

18. REALISTIC MOCK DATA

==================================================

Use realistic campus sports data.

Do NOT use lorem ipsum.

Facilities:

Badminton Court 1

Badminton Court 2

Tennis Court 1

Basketball Court

Football Ground

Cricket Ground

Gymnasium

Create realistic booking records, availability states, users, notifications and analytics.

==================================================

19. UX DETAILS

==================================================

Add proper:

• Loading states

• Empty states

• Error states

• Success states

• Toast notifications

• Confirmation dialogs

• Disabled states

• Skeleton loaders where useful

Examples:

Loading:

“Checking availability...”

Error:

“Unable to load availability. Please try again.”

Conflict:

“This slot was just booked by another student.”

Success:

“Booking confirmed successfully.”

==================================================

20. NAVIGATION

==================================================

Use client-side routing.

Routes:

/login

/dashboard

/explore

/facilities/:id

/bookings

/waitlist

/notifications

/admin

/concurrency-demo

All navigation links must actually work.

Do not leave dead buttons or placeholder navigation.

==================================================

21. CODE QUALITY

==================================================

Use a clean component-based architecture.

Create reusable components for:

• Navbar

• FacilityCard

• SlotGrid

• BookingCard

• NotificationItem

• StatCard

• Modal

• Toast

• LoadingState

• EmptyState

Keep business logic separate from UI components.

Use environment variables for API/database configuration.

Do not hardcode secrets.

Create a clear README explaining:

• Project setup

• Environment variables

• Database setup

• Running locally

• Production deployment

• Demo credentials

==================================================

22. DEPLOYMENT READY

==================================================

The project should be structured so it can be deployed directly.

Do not leave unfinished TODO sections.

Do not use fake APIs for core booking functionality if a real backend/database can be implemented.

Make the application production-oriented with:

• Environment variables

• Error handling

• Database validation

• Secure API structure

• Responsive UI

• Clean routing

• Reusable components

==================================================

23. FINAL QUALITY BAR

==================================================

Before finishing, verify:

✓ Desktop responsive

✓ Mobile responsive

✓ No horizontal overflow

✓ Top navbar works

✓ Mobile hamburger works

✓ Student flow works end-to-end

✓ Facility browsing works

✓ Slot selection works

✓ Booking works

✓ Cancellation works

✓ Waitlist works

✓ Alternative recommendations work

✓ Notifications work

✓ Admin dashboard works

✓ Concurrency demo works

✓ Duplicate booking is prevented

✓ Loading/error/success states exist

✓ No broken buttons

✓ No placeholder text

✓ No dead routes

✓ UI looks polished and deployment-ready

MOST IMPORTANT:

Do not make the product look like a generic CRUD dashboard.

The primary experience should be:

DISCOVER FACILITY

→ CHECK AVAILABILITY

→ SELECT SLOT

→ BOOK

→ CONFIRM

And the technical differentiator should be:

CONCURRENT REQUESTS

→ DATABASE TRANSACTION + UNIQUE CONSTRAINT

→ ONE VALID BOOKING

→ ZERO DOUBLE BOOKINGS

Make the final result polished enough that I can deploy it immediately and use it as the actual hackathon prototype.             TECHNOLOGY REQUIREMENT — IMPORTANT

Build the entire web application using NEXT.JS as the primary framework.

Use:

• Next.js (App Router)

• TypeScript

• Tailwind CSS

• shadcn/ui

• PostgreSQL

• Prisma ORM

• Next.js Route Handlers / Server Actions for backend APIs

• Zod for validation

• Recharts for analytics

• Lucide React for icons

Do NOT build this as a plain React/Vite application.

The project must be a proper Next.js App Router application with a clean production-ready structure.

Recommended structure:

app/

├── (auth)/

│   ├── login/

│   └── signup/

│

├── dashboard/

├── explore/

├── facilities/

│   └── [id]/

├── bookings/

├── waitlist/

├── notifications/

├── admin/

└── concurrency-demo/

components/

├── ui/

├── navbar/

├── facilities/

├── booking/

├── dashboard/

└── admin/

lib/

├── db/

├── auth/

├── booking/

├── validation/

└── utils/

prisma/

└── schema.prisma

Use TypeScript throughout the project.

Use Prisma with PostgreSQL for the database.

Implement the booking logic on the server side using database transactions and unique constraints. Never depend on client-side state to prevent double bookings.

Use Next.js Server Actions or Route Handlers for booking operations and server-side validation.

The final project must be deployable as a Next.js application.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0e13f73a-7fce-4ce1-84d0-26fe894e148e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
