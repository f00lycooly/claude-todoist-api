
# Claude Todoist API Integration

A simple API service that enables seamless integration between Claude AI and Todoist, allowing automatic export of action items from conversations directly to your Todoist account.

## 🌟 Features

- **Simple Export**: Quick task creation with minimal configuration
- **Project-Specific Export**: Organize tasks into specific Todoist projects
- **Action Preview**: Preview extracted actions before creating tasks
- **Automatic Context Extraction**: Intelligently parses conversations for actionable items
- **Subtask Support**: Creates structured tasks with subtasks from complex discussions

## 🚀 Available Endpoints

The API is hosted at: `https://todoist.bagofholding.co.uk`

### `/simple-export` - Simplest Method
Exports tasks to your Todoist Inbox by default with minimal configuration.

### `/quick-export` - Project Specification
Allows specifying project names and custom task titles for organized task management.

### `/extract-actions` - Preview Mode
Preview extracted actions without creating actual Todoist tasks.

## 📋 Usage Instructions for Claude AI

### When to Use Todoist Export

Claude should automatically use this integration when you:

- Ask to "export to Todoist" or "send to my tasks"
- Say phrases like "add these to my todo list" or "create tasks for these"
- When conversations naturally produce action items that should be tracked
- When planning sessions result in concrete next steps

### Implementation Code

#### Recommended Method (Quick Export)
```javascript
fetch('https://todoist.bagofholding.co.uk/quick-export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `[extracted action items from our conversation]`,
    mainTaskTitle: "[descriptive title for the main task]", // optional but recommended
    projectName: "[project name like 'Work' or 'Personal']" // optional, defaults to Inbox
  })
})
```

#### Simple Method
```javascript
fetch('https://todoist.bagofholding.co.uk/simple-export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `[action items from our conversation]`
  })
})
```

#### Preview Method
```javascript
fetch('https://todoist.bagofholding.co.uk/extract-actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `[conversation text to analyze]`
  })
})
```

### Action Item Extraction Guidelines

Claude should extract action items by:

- **Identifying concrete, actionable tasks** from conversations
- **Including bullet points, numbered lists**, and explicit action statements
- **Looking for key phrases** like:
  - "I need to..."
  - "Next steps include..."
  - "Action items:"
  - "TODO:"
  - "Remember to..."
- **Converting discussion points** into specific, actionable tasks
- **Maintaining original context** and specificity

### Response Format

After successful export, Claude should confirm with:

```
✅ I've exported [X] action items to your Todoist [project name]. The main task '[title]' contains [X] subtasks covering [brief description of what was exported].
```

If export fails, Claude should explain the error and offer to try again or suggest manual export.

## 💡 Usage Examples

### Example 1: Project Planning
**User:** "Let's plan out the new website project. I need to research hosting options, create wireframes, set up the development environment, and schedule a client meeting."

**Claude Response:** 
```javascript
fetch('https://todoist.bagofholding.co.uk/quick-export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `• Research hosting options for new website
• Create wireframes for website layout
• Set up development environment
• Schedule client meeting to discuss requirements`,
    mainTaskTitle: "Website Project Planning",
    projectName: "Work"
  })
})
```

**Confirmation:** "✅ I've exported 4 action items to your Todoist Work project. The main task 'Website Project Planning' contains subtasks for researching hosting options, creating wireframes, setting up the development environment, and scheduling a client meeting."

### Example 2: Meeting Follow-up
**User:** "From today's team meeting, export the action items to my Work project in Todoist."

**Claude extracts items from conversation context and exports to Work project**

### Example 3: Personal Planning
**User:** "I have a lot to do this weekend - grocery shopping, cleaning the garage, calling mom, and preparing for Monday's presentation. Can you add these to my tasks?"

**Claude Response:** Creates tasks in Personal project or Inbox with appropriate structure.

## 🎯 Trigger Phrases

Train yourself to use these phrases to activate the integration:

- "Export these to Todoist"
- "Add these to my todo list"
- "Send these action items to my tasks"
- "Create Todoist tasks for these"
- "Export our discussion to Todoist"
- "Add this to my [project name] project"

## 🔧 How to Add This to Claude

### Method 1: Project Instructions (Recommended)

1. Create a new Project in Claude
2. Add this prompt to Project Instructions
3. Use this project for conversations where you want Todoist integration

### Method 2: Conversation Context

1. Start a new conversation
2. Paste the global prompt as your first message
3. Claude will remember these instructions for the entire conversation

### Method 3: Custom Instructions (if available)

1. Add to your Claude account's custom instructions
2. This will apply to all conversations automatically

## 🔄 Advanced Usage

### Preview Before Export
**User:** "What action items would you extract from our conversation?"
**Claude:** Makes call to `/extract-actions` to show preview without creating tasks

### Specific Project Export
**User:** "Export these to my Work project in Todoist"
**Claude:** Uses `/quick-export` with `projectName: "Work"`

### Custom Main Task Title
**User:** "Export our quarterly planning discussion with a descriptive title"
**Claude:** Uses `mainTaskTitle: "Q4 2025 Strategic Planning Session"`

## 🛠️ Technical Details

### API Requirements

- **Content-Type**: `application/json`
- **Method**: `POST`
- **Base URL**: `https://todoist.bagofholding.co.uk`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The action items or conversation text to process |
| `mainTaskTitle` | string | No | Custom title for the main task |
| `projectName` | string | No | Target Todoist project name |

### Response Format

Successful responses return task creation confirmation. Failed requests include error details for debugging.

## 🔐 Authentication

This API handles Todoist authentication internally. Users don't need to provide their own Todoist API tokens.

## ⚠️ Important Notes

- The API intelligently parses conversation text to extract actionable items
- Tasks are created with appropriate structure (main task with subtasks)
- Default project is Inbox if no project name is specified
- The service respects Todoist rate limits and handles errors gracefully

## 📝 Contributing

This project enables seamless task management between AI conversations and Todoist. For issues or feature requests, please create an issue in the repository.

## 📄 License

[Include your license information here]

---

**Ready to boost your productivity?** Start using trigger phrases in your Claude conversations and watch your action items automatically flow into Todoist!