# Issues and Projects — Projects

The project as the home of issues.
Part of the [Issues and Projects specs](../issues.md).

- A project is the home of issues; every Kerghan issue belongs to exactly one project. A project may be about code or anything else.
- A project has 0 or 1 linked repository (one of the user's repository rows). No repository means a non-code project.
- A project has one owner and is private: another user's project answers 404.
- Sharing, members and roles are out of scope, but nothing here may make them impossible later.
- Creation is explicit (optionally picking an added repository, the only way to make a non-code project), plus a shortcut that creates a project from an added repository.

## Open questions

- [ ] May one repository back several projects of the same user? (#485)
- [ ] Which fields does a project have? (#485)
- [ ] What happens to a project when its linked repository is removed? (#485)
- [ ] How is a project deleted, and what happens to its issues? (#485)
- [ ] What room is left for sharing, members and roles? (#485)

## Required tests

- Another user's project answers 404.
- A project without a repository can be created.
- A project can link one added repository.
