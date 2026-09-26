import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface TaskItem {
  id: number;
  title: string;
  owner: string;
  due: string;
  lane: 'Today' | 'This Week' | 'Blocked';
  done: boolean;
  priority: 'High' | 'Medium' | 'Low';
}

@Component({
  selector: 'app-v4-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './v4-tasks.html',
  styleUrls: ['../v4-shared/v4-page.css', './v4-tasks.css']
})
export class V4TasksComponent {
  tasks: TaskItem[] = [
    { id: 1, title: 'Follow up with Forte Capital legal team', owner: 'Yuriy', due: '11:30', lane: 'Today', done: false, priority: 'High' },
    { id: 2, title: 'Prepare weekly escalation digest', owner: 'Mona', due: '13:00', lane: 'Today', done: true, priority: 'Medium' },
    { id: 3, title: 'Review duplicate ticket closure workflow', owner: 'Safa', due: 'Tomorrow', lane: 'This Week', done: false, priority: 'Medium' },
    { id: 4, title: 'Finalize new L2 assignment policy', owner: 'Ops', due: 'Thu', lane: 'This Week', done: false, priority: 'High' },
    { id: 5, title: 'Jira webhook validation pending IT firewall', owner: 'IT', due: 'Awaiting', lane: 'Blocked', done: false, priority: 'High' }
  ];

  readonly lanes: Array<TaskItem['lane']> = ['Today', 'This Week', 'Blocked'];

  get completion(): number {
    if (!this.tasks.length) return 0;
    const done = this.tasks.filter(t => t.done).length;
    return Math.round((done / this.tasks.length) * 100);
  }

  toggleTask(task: TaskItem): void {
    task.done = !task.done;
  }

  laneTasks(lane: TaskItem['lane']): TaskItem[] {
    return this.tasks.filter(t => t.lane === lane);
  }
}
