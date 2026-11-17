// The types of the sources module that other modules use. Another module imports only application/** (MOD-3) and a re-export is not
// allowed (TSN-18), so each type is named again here as an alias of the declaring type.
import type * as Acquisition from '#sources/domain/model/Acquisition.ts';
import type * as Version from '#sources/domain/rules/gitVersion.ts';

/** What the lock holds for a git source before this run. */
export type LockedGit = Acquisition.LockedGit;
/** What a caller gives to acquire a git source. */
export type GitAcquireRequest = Acquisition.GitAcquireRequest;
/** How acquiring a git source ended. */
export type GitAcquireResult = Acquisition.GitAcquireResult;
/** A git source whose clone is at the commit this run uses. */
export type GitAcquired = Acquisition.GitAcquired;
/** How acquiring a path source ended. */
export type PathAcquireResult = Acquisition.PathAcquireResult;
/** What the git version check found. */
export type GitVersionCheck = Version.GitVersionCheck;
/** What a caller gives to acquire a path source. */
export type PathAcquireRequest = Acquisition.PathAcquireRequest;
