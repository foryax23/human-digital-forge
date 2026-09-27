# Project architecture decisions

- Homepage visual effects use the existing Motion/CSS/canvas stack with off-screen pausing and reduced-motion fallbacks, avoiding additional animation runtimes for performance.