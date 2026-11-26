# Writing a survey

A survey is one YAML file for each year. The engine in DistrictWorkflow (`@lbdistrictscouts/survey-engine`)
reads it, checks it and compiles it. `examples/survey.example.yaml` is a complete, made-up example.

## Structure

```yaml
survey:
  id: example-2027              # lower-case letters, numbers and hyphens
  title: Example district survey 2027
  limits: { maxPaths: 512, maxQuestionsPerPath: 60, maxTextLength: 1000 }

reporting:
  breakdowns: [age-group, section, adult-roles]   # questions whose answers create results groups

blocks:                          # one section of the survey each
  - id: about-you
    title: About you
    questions:                   # questions and panels, in order
      - id: age-group
        type: single
        text: Which best describes you?
        options:
          - { id: adult, text: I'm an adult, sets: [adult] }
```

A section appears only if at least one of its questions or panels does.

## Questions

| Field | Meaning |
| --- | --- |
| `id` | Lower-case words and hyphens. Results across years are compared by ID, so keep it for the same question |
| `type` | `single`, `multiple`, `scale` or `text` |
| `text`, `help` | The question, and optional help below it |
| `required` | Defaults to true, except for `text`, which defaults to false |
| `showIf` | `all`, `any` and `none` lists of tags. All must hold |
| `options` | For `single` and `multiple`: `id`, `text`, optional `sets`, `showIf` and `preselectIf` |
| `min`, `max`, `minLabel`, `maxLabel` | For `scale` |
| `maxLength`, `comment` | For `text`. Comment answers are stored apart from the response and reviewed before analysts see them |
| `showInResults` | Defaults to true, except for `text`. The `visibleQuestions` setting takes priority |
| `replaces` | The previous year's ID that this question replaces |

Panels show information without asking anything:

```yaml
- id: adult-help
  type: panel
  kind: help          # the black on yellow help message. Use info for anything else
  showIf: { all: [adult] }
  text: Comments are not read straight away. If you need help now, contact the district team.
```

## Tags

An answer option can set tags with `sets`. Later questions, panels and options use them in `showIf`. Tags only
decide what is shown; they are never stored or reported.

- A question can depend only on tags set by **earlier** questions.
- The site sets `source:open` or `source:tracked`. A survey cannot set these itself.
- `preselectIf` ticks an option before the person answers. The example uses it to preselect Volunteer on a tracked link,
  and `showIf: { none: [source:tracked] }` hides the young-person option there.
- A question shared by several roles, such as `showIf: { any: [parent, volunteer] }`, is asked once.

## Rules

`yarn survey:validate <file> [--previous <last year>] [--settings <settings>]` checks every rule and lists every
question path with its length. Each problem names the question, the rule and the fix.

| Rule | Fails when |
| --- | --- |
| `schema` | The file does not match the format |
| `duplicate-id` | Two blocks, questions or panels, or two options in one question, share an ID |
| `system-tag` | An option sets `source:open` or `source:tracked` |
| `unknown-tag` | A condition uses a tag that no answer sets |
| `later-tag` | A condition uses a tag set only at or after that point |
| `unreachable` | A question or panel is not shown on any path, so its condition can never hold |
| `path-limit`, `path-length` | There are more paths than `maxPaths`, or a path has more questions than `maxQuestionsPerPath` |
| `young-free-text` | A text question can be reached on a path with the `beavers` or `cubs` tag |
| `comment-help` | A comment question has no `kind: help` panel in its block |
| `breakdown` | A breakdown is not a single or multiple choice question in the survey |
| `changed-question` | A question ID from the previous survey has different wording or options. Restore it, or use a new ID with `replaces` |
| `unknown-replaces` | `replaces` names an ID that is not in the previous survey |
| `settings`, `theme-contrast` | The settings name another survey or missing questions, or a theme colour pair misses its contrast target |

## Changing a survey after it opens

The fingerprint covers question IDs, types, options, conditions, ranges and breakdowns. Wording, help text and
dates are left out. Once the survey is open, DistrictStatistics refuses a version with a different fingerprint, so
only wording and dates can change. Changing what a question means requires closing the survey, and saved drafts
are discarded.

## Next year

Copy the file, change `survey.id` and `title`, and run `yarn survey:validate new.yaml --previous old.yaml`. No
application code changes. `examples/survey-second-year.example.yaml` shows a replaced question and a new one.
