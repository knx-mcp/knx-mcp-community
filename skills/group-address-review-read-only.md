# Read-only workflow: group-address quality review

**Purpose:** Review a selected ETS project's group-address structure and flag items that may need manual investigation.

**Applicable release:** KNX-MCP 1.1.0.0 or later, ETS5 5.7+ or ETS6.

**Safety level:** Project data inspection only. **No project edits, bus reads/writes or device programming.**

## Prerequisites

- The intended ETS project is open and **Project MCP is switched on**.
- KNX-MCP is connected to an MCP-capable client.
- Prefer **Read-only** mode in the KNX-MCP Tools panel.
- If multiple projects are accessible, select the intended project explicitly.

## Required permissions

Only read/inspect/analyse group addresses and their available metadata and associations. Do not change a group address, datapoint type, link, parameter or tool permission.

## Workflow

1. Identify the project selected by the user and define the review scope (for example, a whole project or one main group).
2. Inspect the available group-address structure, names, datapoint types and associations.
3. Look for **potential** issues such as missing datapoint types, ambiguous naming and group addresses associated with more than one sender **where the available data allows that conclusion**.
4. Distinguish verified findings from observations that require manual review. More than one sender is not automatically an error; the design may be intentional.
5. Present the findings as a table with **Group address**, **Finding**, **Evidence**, **Suggested manual check**. Mark information that could not be checked as **not assessed**.
6. Do not apply fixes, link communication objects, send telegrams or change project settings. A later remediation must be requested and approved separately.

## Example user request

> Review the group addresses in my selected ETS project. Identify missing datapoint types and suspicious naming or sender configurations that can be established from project data. Give me a table with the relevant address, evidence and a suggested manual check. Do not edit the project or access the KNX bus, and clearly separate uncertain findings.

## Expected result

An evidence-based report of potential group-address quality issues and explicit limits of the inspection. No automatic repair and no assertion that a heuristic warning is a confirmed installation defect.

## Privacy and confirmation points

Group addresses and associated room or device names may be customer-sensitive. Anonymise the report before publishing. Any follow-up change must respect the project's tool permissions, confirmation requirements and ETS undo model; those actions are outside this read-only workflow.
