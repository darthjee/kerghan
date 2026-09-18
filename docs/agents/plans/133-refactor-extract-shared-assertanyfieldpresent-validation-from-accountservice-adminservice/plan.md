# Plan: Refactor: extract shared assertAnyFieldPresent validation from AccountService/AdminService

Issue: [133-refactor-extract-shared-assertanyfieldpresent-validation-from-accountservice-adminservice.md](../issues/133-refactor-extract-shared-assertanyfieldpresent-validation-from-accountservice-adminservice.md)

## Overview

Behaviour-preserving refactor: `AccountService` and `AdminService` each declare a private
`#assertAnyFieldPresent` with byte-identical logic. Extract it into one shared free function in
`backend/src/auth/` and have both services call it, removing the duplicated private copies.

See [backend.md](backend.md) for the full plan.
