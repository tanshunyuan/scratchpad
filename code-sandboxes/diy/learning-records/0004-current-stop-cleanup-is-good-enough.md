# Current stop cleanup is good enough

User tested preview stop behavior and confirmed no process remains listening on the preview port after stop. Process-tree cleanup is not needed for the current MVP; future sessions should only revisit this if restart leaves the port busy or orphan processes appear.
