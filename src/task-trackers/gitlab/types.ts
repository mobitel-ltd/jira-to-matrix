import { Project, Issue } from '../../types';

export interface GitlabUserData extends GitlabUserDataShort {
    access_level: number;
    expires_at: string | null;
}

export interface GitlabUserDataShort {
    state: string;
    web_url: string;
    avatar_url: string | null;
    username: string;
    id: number;
    name: string;
}

export interface GitlabIssue extends Issue {
    project_id: number;
    milestone: {
        due_date: string | null;
        project_id: number;
        state: string;
        description: string;
        iid: number;
        id: number;
        title: string;
        created_at: string;
        updated_at: string;
        start_date?: string;
        closed_at?: string;
    };
    author: UserData;
    description: string;
    state: string;
    iid: number;
    assignees: UserData[];
    assignee: UserData;
    labels: [];
    upvotes: number;
    downvotes: number;
    merge_requests_count: number;
    id: number;
    title: string;
    updated_at: string;
    created_at: string;
    closed_at: string | null;
    closed_by: string | null;
    subscribed: boolean;
    user_notes_count: number;
    due_date: string | null;
    web_url: string;
    references: {
        short: string;
        relative: string;
        full: string;
    };
    time_stats: {
        time_estimate: number;
        total_time_spent: number;
        human_time_estimate: string | null;
        human_total_time_spent: string | null;
    };
    confidential: boolean;
    discussion_locked: boolean;
    _links: {
        self: string;
        notes: string;
        award_emoji: string;
        project: string;
    };
    task_completion_status: {
        count: number;
        completed_count: number;
    };
}

export interface GitlabProject extends Project {
    id: number;
    description: string;
    name: string;
    name_with_namespace: string;
    path: string;
    path_with_namespace: string;
    created_at: string;
    default_branch: string;
    tag_list: [];
    ssh_url_to_repo: string;
    http_url_to_repo: string;
    web_url: string;
    readme_url: string;
    avatar_url: string | null;
    star_count: number;
    forks_count: number;
    last_activity_at: string;
    namespace: {
        id: number;
        name: string;
        path: string;
        kind: string;
        full_path: string;
        parent_id: string | null;
        avatar_url: string | null;
        web_url: string;
    };
    _links: {
        self: string;
        issues: string;
        merge_requests: string;
        repo_branches: string;
        labels: string;
        events: string;
        members: string;
    };
    empty_repo: boolean;
    archived: boolean;
    visibility: string;
    resolve_outdated_diff_discussions: boolean;
    container_registry_enabled: boolean;
    container_expiration_policy: {
        cadence: string;
        enabled: boolean;
        keep_n: string | null;
        older_than: string | null;
        name_regex: string | null;
        next_run_at: string;
    };
    issues_enabled: boolean;
    merge_requests_enabled: boolean;
    wiki_enabled: boolean;
    jobs_enabled: boolean;
    snippets_enabled: boolean;
    issues_access_level: string;
    repository_access_level: string;
    merge_requests_access_level: string;
    wiki_access_level: string;
    builds_access_level: string;
    snippets_access_level: string;
    shared_runners_enabled: boolean;
    lfs_enabled: boolean;
    creator_id: number;
    import_status: string;
    open_issues_count: number;
    ci_default_git_depth: number;
    public_jobs: boolean;
    build_timeout: number;
    auto_cancel_pending_pipelines: string;
    build_coverage_regex: string | null;
    ci_config_path: string | null;
    shared_with_groups: [];
    only_allow_merge_if_pipeline_succeeds: boolean;
    request_access_enabled: boolean;
    only_allow_merge_if_all_discussions_are_resolved: boolean;
    remove_source_branch_after_merge: boolean;
    printing_merge_request_link_enabled: boolean;
    merge_method: string;
    suggestion_commit_message: string | null;
    auto_devops_enabled: boolean;
    auto_devops_deploy_strategy: string;
    autoclose_referenced_issues: boolean;
    permissions: {
        project_access: {
            access_level: number;
            notification_level: number;
        };
        group_access: string | null;
    };
}
