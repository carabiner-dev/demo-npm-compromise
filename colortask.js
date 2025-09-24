#!/usr/bin/env node

import chalk from 'chalk';
import readline from 'readline';

class TaskManager {
    constructor() {
        this.tasks = [];
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    showHeader() {
        console.clear();
        console.log(chalk.blue.bold('╔══════════════════════════════════╗'));
        console.log(chalk.blue.bold('║     ') + chalk.white.bold('📋 TASK MANAGER CLI') + chalk.blue.bold('          ║'));
        console.log(chalk.blue.bold('╚══════════════════════════════════╝'));
        console.log();
    }

    showMenu() {
        console.log(chalk.yellow.bold('Available commands:'));
        console.log(chalk.green('  add <task>    ') + chalk.white('- Add a new task'));
        console.log(chalk.green('  list          ') + chalk.white('- Show all tasks'));
        console.log(chalk.green('  done <id>     ') + chalk.white('- Mark task as complete'));
        console.log(chalk.green('  remove <id>   ') + chalk.white('- Remove a task'));
        console.log(chalk.green('  clear         ') + chalk.white('- Clear all tasks'));
        console.log(chalk.green('  help          ') + chalk.white('- Show this menu'));
        console.log(chalk.red('  exit          ') + chalk.white('- Exit the app'));
        console.log();
    }

    addTask(taskText) {
        if (!taskText.trim()) {
            console.log(chalk.red.bold('❌ Task cannot be empty!'));
            return;
        }

        const task = {
            id: this.tasks.length + 1,
            text: taskText.trim(),
            completed: false,
            createdAt: new Date().toLocaleString()
        };

        this.tasks.push(task);
        console.log(chalk.green.bold('✅ Task added: ') + chalk.white(taskText));
    }

    listTasks() {
        if (this.tasks.length === 0) {
            console.log(chalk.yellow.bold('📝 No tasks yet! Add one with: add <task>'));
            return;
        }

        console.log(chalk.blue.bold('\n📋 Your Tasks:'));
        console.log(chalk.blue('─'.repeat(50)));

        this.tasks.forEach(task => {
            const status = task.completed ? 
                chalk.green.bold('✓') : 
                chalk.red.bold('○');
            
            const taskText = task.completed ? 
                chalk.gray.strikethrough(task.text) : 
                chalk.white(task.text);

            const timestamp = chalk.dim(`(${task.createdAt})`);

            console.log(`${status} ${chalk.cyan(`[${task.id}]`)} ${taskText} ${timestamp}`);
        });
        console.log();
    }

    completeTask(id) {
        const taskId = parseInt(id);
        const task = this.tasks.find(t => t.id === taskId);

        if (!task) {
            console.log(chalk.red.bold(`❌ Task with ID ${taskId} not found!`));
            return;
        }

        if (task.completed) {
            console.log(chalk.yellow.bold(`⚠️  Task "${task.text}" is already completed!`));
            return;
        }

        task.completed = true;
        console.log(chalk.green.bold('🎉 Task completed: ') + chalk.white(task.text));
    }

    removeTask(id) {
        const taskId = parseInt(id);
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);

        if (taskIndex === -1) {
            console.log(chalk.red.bold(`❌ Task with ID ${taskId} not found!`));
            return;
        }

        const removedTask = this.tasks.splice(taskIndex, 1)[0];
        console.log(chalk.magenta.bold('🗑️  Task removed: ') + chalk.white(removedTask.text));
    }

    clearAllTasks() {
        if (this.tasks.length === 0) {
            console.log(chalk.yellow.bold('📝 No tasks to clear!'));
            return;
        }

        this.tasks = [];
        console.log(chalk.green.bold('🧹 All tasks cleared!'));
    }

    processCommand(input) {
        const [command, ...args] = input.trim().split(' ');
        const argument = args.join(' ');

        switch (command.toLowerCase()) {
            case 'add':
                this.addTask(argument);
                break;
            case 'list':
                this.listTasks();
                break;
            case 'done':
                this.completeTask(argument);
                break;
            case 'remove':
                this.removeTask(argument);
                break;
            case 'clear':
                this.clearAllTasks();
                break;
            case 'help':
                this.showMenu();
                break;
            case 'exit':
                console.log(chalk.blue.bold('👋 Goodbye! Thanks for using Task Manager CLI!'));
                this.rl.close();
                return false;
            default:
                console.log(chalk.red.bold('❌ Unknown command. Type "help" for available commands.'));
        }
        return true;
    }

    start() {
        this.showHeader();
        this.showMenu();

        const promptUser = () => {
            this.rl.question(chalk.cyan.bold('taskman> '), (input) => {
                console.log(); // Add spacing
                
                if (this.processCommand(input)) {
                    console.log(); // Add spacing after command execution
                    promptUser(); // Continue the loop
                }
            });
        };

        promptUser();
    }
}

// Initialize and start the task manager
const taskManager = new TaskManager();

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log(chalk.blue.bold('\n\n👋 Goodbye! Thanks for using Task Manager CLI!'));
    process.exit(0);
});

taskManager.start();
