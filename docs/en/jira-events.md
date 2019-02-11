# Jira events

This article should show all actions in jira and events they make in Matrix.

# Jira events

## Comment

1. Creating a comment in the task:
    * Add a comment in the corresponding room in the Matrix with the text:
    ```
    <Comment author> added comment:
    <Comment text>
    ```

2. Delete a comment in the task:
    * No action.

3. Editing a comment in a task:
    * Add a comment in the corresponding room in the Matrix with the text:
    ```
    <Comment author> changed the comment:
    <New comment text>
    ```

## Communication

1. Creating a connection in the tasks:
    * Add a comment in both corresponding rooms in the Matrix with the text:
    ```
    New link, this task <link type> <task key> "<task theme>"
    ```

2. Deleting a connection in tasks:
    * Add a comment in both corresponding rooms in the Matrix with the text:
    ```
    The link has been deleted, this task is no longer <link type> <task key> "<task theme>"
    ```

## Task

1. Creating a task:
    * Creating a room with the name `<Task key Task name>`, and a link to the task in the topic
    * In the first message follow the field (`Epic link` with the existence of the task):
        ```
        Assignee:
        <Name of the artist>
        <email>

        Reporter:
        <Name of the author>
        <email>

        Type:
        <Task type>

        Estimate time:
        <Deadline>

        Description:
        <Description>

        Priority:
        <Priority>

        Epic link
        <Key Epic>
        <Epic link>
        ```
    * Observers, author and performer of the task are invited to the room.
    * Notification to the epic task room (if there is an epic) follow with a link to the corresponding task:
    ```
    Added to the epic task <task key> <task name>
    ```

2. Invitation of a new observer:
    * An appropriate Matrix user is invited to the task room.

3. Adding / modifying an epic task in essence:
    * A change message arrives in the room with a task in Matrix.

4. Changing task status:
    * A message is added to the room with the task.
    ```
    <author> changed the task
    status: <new status>
    resolution: Done (only if the task is closed)
    ```
    * If there is a connection or epic:
    ```
    <task key task name> is now in status <task status>
    <author> changed the status of the associated task <task key task name link to task> to <task status>
    ```

5. Changing the rank of the task (only for next-gen):
    ```
    <author> changed the task
    Rank: Rank lower / higher
    ```

## Epic

1. Creating an epic:
    * A message is added to the project room:
    ```
    New epic in the project
    Added to the project epic <key epic epic title link to epic>
    ```
2. Change epic:
    * A message is added to the project room:
    ```
    Epic changed
    <author> changed the status of the associated epic <key epic epic name link to epic> to <status epic>
    ```