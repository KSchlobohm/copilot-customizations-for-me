---
name: "Technology Migration Prompt Template"
description: "A generic, reusable prompt template for migrating a codebase from a source technology to a target technology. Fill in the YAML values and replace each bracketed placeholder before use."
config:
  source_technology: "Technology X"    # The old dependency/library/framework to be removed
  target_technology: "Technology Y"    # The new dependency/library/framework to be introduced
---

# Technology Migration Prompt Template: [source_technology] to [target_technology]

> Before using this template, either replace every bracketed placeholder in the body with your actual technologies or run it through a prompt system that interpolates the frontmatter values. Editing the YAML alone does not update the body text by itself.

## Migration Request

Migrate this codebase from [source_technology] to [target_technology], focusing **exclusively** on code-level changes required for a successful build.

**Autonomous Execution Mode**: This migration MUST be executed autonomously without pausing for user confirmation at any step. Once you begin, continue until all tasks are complete or an unrecoverable error occurs.

## Research Guidance

Before writing any code, research [target_technology] thoroughly. Do not assume knowledge of its API, configuration, or best practices.

- Search the web, official documentation, and community resources for [target_technology] migration guides, SDK references, and code samples.
- If [target_technology] is not well-known or its details cannot be sourced from the existing codebase, treat external research as a required first step.
- Prefer official documentation and widely-adopted community samples when making implementation decisions.
- Save key dependency versions and configuration patterns discovered during research for reference throughout the migration.

## Scope

* DO - Collect the runtime/framework used and keep the original project framework
* DO - Modify code to replace [source_technology] dependencies with [target_technology] equivalents
* DO - Update configuration files as necessary for a successful build
* DO - Update dependency management as needed
* DO - Update function references to use the newly generated functions.
* DO NOT - Add new business logic, features, or functionality beyond what exists in the original codebase
* DO NOT - Enhance or improve existing business logic during migration
* DO NOT - Perform testing beyond build verification
* DO NOT - Consider deployment

## Success Criteria

1. All [source_technology] dependencies and imports are replaced.
2. All old [source_technology] code files and project configurations are cleaned from the workspace.
3. Codebase builds successfully with [target_technology].
4. All migration tasks are tracked and marked as completed.
5. All uncommitted changes are committed if a version control system is detected.

## Execution Process

### Analyze and Identify Migration Tasks

1. First, research [target_technology] using external documentation and community resources (see Research Guidance above).
   - Collect required package dependencies and save dependency versions for reference.
2. Analyze the codebase to identify all [source_technology] usages as well as those places using the old [source_technology] API.
   - Identify all files that need to be modified.
   - Identify all dependencies that need to be updated.
   - Identify all configuration files that need to be updated.
   - Identify all project files that need to be updated.

### Create Migration Tracking

Before executing any tasks, create a progress tracker — a simple markdown checklist — to document the migration plan and track task status. If one already exists, clear it before starting.

**CRITICAL**: Once the progress tracker is created, you MUST immediately proceed to execute the migration. Do NOT ask the user for confirmation, review, or approval. Continue directly to the "Execute Migration and Track Progress" section without interruption.

### Execute Migration and Track Progress

Execute the migration tasks as follows:

1. Refer to section `Important Guideline` about how to track the status.
2. Execute migration tasks in the order they are listed in the progress tracker.
3. You DO NOT need to pause for confirmation between tasks.
4. Continue until all tasks are complete.
5. Run **Completeness Validation**, if there are any issues found, append any new tasks to the progress tracker and continue to execute the new tasks.
6. Run **Consistency Validation**, if there are any issues found, append any new tasks to the progress tracker and continue to execute the new tasks.
7. Make sure the build passes for the entire project after all steps; keep fixing until the project builds successfully. **CRITICAL** Report the final build status via tool `report_build_verification_summary`.
8. Finish all the tasks and do not deviate from the plan unless absolutely necessary.
9. Before finishing, review the progress tracker to ensure all tasks are completed.

## Important Guideline

1. When you use the terminal command tool, never input a long command with multiple lines; always use a single-line command.
   - **CRITICAL**: Prefer tools related to editing files to make changes and do not use terminal commands to create, write, modify, or append to files.
2. Never create a new component in the workspace build system; always use the existing project structure to add new files or update existing files.
4. Minimize code changes:
    - Update only what's necessary for the migration.
    - Avoid unrelated code enhancements.
5. Add and remove package references as needed
   - Use the package manager appropriate for this project's ecosystem to install and uninstall packages.
   - If the package manager is unclear, examine the existing project files and dependency manifests to determine the correct tool.
   - If an operation fails, research the official documentation for [target_technology] to resolve it.
6. **Task Tracking and Progress Updates**
   - Maintain a running progress tracker as a Markdown checklist.
     - `- [ ]` for tasks not started
     - `- [X]` for tasks completed
     - `- [in_progress]` for tasks currently being worked on
   - Before starting any migration task, mark it as `in_progress`. Only one task should be marked as `in_progress` at a time.
   - As soon as a task is completed, immediately update its status to completed.
   - If you discover new required tasks during migration, add them to the tracker immediately.
   - For tasks that are skipped or turned out to be unnecessary, mark them as completed with a note explaining why.
   - Do not batch status updates; always update as soon as a task's status changes.
   - After all tasks are finished, review the tracker to ensure every task is marked as complete, and then log the exact words `MIGRATION COMPLETED`.
7. **Version Control Integration**
   - Record the original commit id before starting migration tasks for future reference.
   - ALWAYS include version control tasks in the progress tracker:
     - Use `migrate_get_repo_state` to check git status before starting migration tasks
     - Use `migrate_git_stash` if there are any uncommitted (modified/added/untracked) changes before creating the migration branch, to ensure a clean working directory.
     - Use `migrate_git_checkout` to ALWAYS create a new migration branch using a name generated from `migrate_get_branch_name`
     - Use `migrate_git_commit` to stage and commit changes after each completed task
     - Use `migrate_get_repo_state` to check for uncommitted changes before finishing

## Completeness Validation

Evaluate the completeness of the migration by identifying any remaining references to the old technology that should have been updated.

- Commit all the changes if there are any uncommitted changes.
- Call tool `migration_completeness` to get the guide for the validation and perform the scan and check on the entire codebase.
- If there are any completeness issues found, summarize the issues as TODO tasks.
- If there is no issue found, summarize the completeness validation result.

## Consistency Validation

Evaluate the consistency between the original codebase and the migrated codebase to ensure no unintended changes were introduced during the migration.

- Commit all the changes if there are any uncommitted changes.
- Call tool `migrate_git_diff` with the original commit id and `HEAD` to get all code changes made during the migration.
- Call tool `migration_consistency` to get the guide for the validation and perform the validation on the diff content.
- If there are any consistency issues found, summarize the issues as TODO tasks.
- If there is no issue found, summarize the consistency validation result.

## CVE Vulnerability Check

- After necessary code changes are done, summarize all the added packages with their versions, and call tool `check_cve_vulnerability` to check if there are any known CVE vulnerabilities.
- If there are any vulnerabilities, change the package version to a non-vulnerable one to make sure there is no known CVE vulnerability.
- Only check the packages that are added during the migration session, do not check the packages that are not changed.
- After the CVE check is done or if there are any issues calling the cve check tool, summarize the check result or issue.

## Build Verification

After all steps, you are REQUIRED to:
- Add newly created components to the workspace build system if applicable
- Build the project using the build system detected in the codebase
- Report success/failure
- Fix any build errors and re-verify
- **CRITICAL** Report the final build status via tool `report_build_verification_summary`

## Unit Test Verification (if applicable)

If the project contains unit tests, run a specific subset of unit tests and report the results. If any tests fail, fix the issues until all tests pass.
- If there are no unit tests in the project, skip this step.
- Only focus on mocked unit tests that do not require external dependencies. Ignore failed ones if the error message indicates a lack of external dependencies.
- Only run a subset of tests that are related to the modified code, do not run all the tests in the project.

**IMPORTANT**: When the `run_tests` tool is available in your toolset, you MUST use it instead of running tests via terminal commands. The `run_tests` tool provides better integration with the IDE and more detailed test results. Only fall back to terminal commands if `run_tests` is not available.

Run a focused subset of tests related to the modified code using the test runner appropriate for this project's ecosystem.
