FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

USER root

# Ensure libc cache exists and is populated at build time
RUN /sbin/ldconfig

# Add an entrypoint that refreshes ld.so cache at container start (safety net)
COPY entrypoint.sh /usr/local/share/tandem-entrypoint.sh
RUN chmod +x /usr/local/share/tandem-entrypoint.sh

USER node

ENTRYPOINT ["/usr/local/share/tandem-entrypoint.sh"]
CMD ["sleep", "infinity"]