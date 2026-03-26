# Tandem Learnings Log

This file stores decisions, patterns, and fixes discovered while building Tandem.

Agents should:
- read this before making changes when relevant
- append new learnings after completing tasks
- avoid repeating past mistakes listed here

---

## Format

### [Date] — Short Title

Context:
What was being worked on

Issue:
What went wrong or was unclear

Fix:
What was done to solve it

Rule:
How to avoid this in the future

---

## Example

### Chatbot menu handling

Context:
Users asking "What's on your menu?"

Issue:
Bot dumped full menu immediately

Fix:
Added clarifying question before listing items

Rule:
Always clarify broad queries before returning full structured data
